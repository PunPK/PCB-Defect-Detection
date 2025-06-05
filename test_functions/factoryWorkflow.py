import cv2
import numpy as np
import time


class PCBCounter:
    def __init__(self):
        self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened():
            print("Cannot open camera")
            raise IOError("Camera not accessible")

        # Conveyor belt settings
        self.line_position = 300  # Vertical position of the counting line
        self.line_color = (0, 0, 255)  # Red color for the line
        self.count = 0
        self.last_board_time = 0
        self.min_time_between_boards = 2
        self.board_detected = False
        self.save_path = "test_functions/pcb_captures/"

        # PCB detection parameters
        self.lower_copper = np.array([3, 0, 0])
        self.upper_copper = np.array([45, 255, 255])
        self.kernel = np.ones((5, 5), np.uint8)
        self.min_board_area = 5000  # Minimum area to consider as a PCB

        # Create save directory if not exists
        import os

        if not os.path.exists(self.save_path):
            os.makedirs(self.save_path)

    def process_frame(self, frame):
        # Convert to HSV for better color detection
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        # Create mask for copper color (PCB)
        mask = cv2.inRange(hsv, self.lower_copper, self.upper_copper)

        # Apply morphological operations to reduce noise
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, self.kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, self.kernel)

        return mask

    def detect_pcb(self, mask):
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        # Find the largest contour (likely the PCB)
        largest_contour = max(contours, key=cv2.contourArea)

        # Filter out small contours
        if cv2.contourArea(largest_contour) < self.min_board_area:
            return None

        return largest_contour

    def check_line_crossing(self, contour, frame):
        # Get bounding rectangle of the PCB
        x, y, w, h = cv2.boundingRect(contour)

        # Check if the PCB is crossing the line
        line_crossed = (y < self.line_position) and (y + h > self.line_position)

        # Draw bounding box
        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

        return line_crossed

    def run(self):
        while True:
            ret, frame = self.cap.read()
            if not ret:
                print("Failed to capture frame")
                break

            # Flip frame horizontally to simulate mirror view
            frame = cv2.flip(frame, 1)

            # Process the frame to detect PCBs
            mask = self.process_frame(frame)
            contour = self.detect_pcb(mask)

            # Draw counting line
            cv2.line(
                frame,
                (0, self.line_position),
                (frame.shape[1], self.line_position),
                self.line_color,
                2,
            )

            # Display count on frame
            cv2.putText(
                frame,
                f"Count: {self.count}",
                (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (255, 255, 255),
                2,
            )

            if contour is not None:
                line_crossed = self.check_line_crossing(contour, frame)

                current_time = time.time()
                if line_crossed and not self.board_detected:
                    # Check if enough time has passed since last board
                    if (
                        current_time - self.last_board_time
                        > self.min_time_between_boards
                    ):
                        self.count += 1
                        self.last_board_time = current_time
                        self.board_detected = True

                        # Save the captured PCB image
                        timestamp = int(time.time())
                        cv2.imwrite(f"{self.save_path}pcb_{timestamp}.jpg", frame)
                        print(f"PCB detected! Total count: {self.count}")
                elif not line_crossed:
                    self.board_detected = False

            # Display the frame
            cv2.imshow("Conveyor Belt PCB Counter", frame)

            # Exit on 'q' key
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

        self.cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    counter = PCBCounter()
    counter.run()
