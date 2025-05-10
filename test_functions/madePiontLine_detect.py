import cv2
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.widgets import Button, Slider
from collections import deque


class CopperWireTracker:
    def __init__(self, image_path):
        # โหลดภาพ
        self.image = cv2.imread(image_path)
        if self.image is None:
            raise ValueError("ไม่สามารถโหลดภาพได้ กรุณาตรวจสอบเส้นทางไฟล์")

        self.image_rgb = cv2.cvtColor(self.image, cv2.COLOR_BGR2RGB)
        self.original_image = self.image_rgb.copy()
        self.working_image = self.image_rgb.copy()

        # กำหนดพารามิเตอร์เริ่มต้นสำหรับการตรวจจับ
        self.hue_min = 15
        self.hue_max = 30
        self.sat_min = 70
        self.sat_min_value = 100
        self.value_min = 150

        # ความหนาของเส้นที่แสดง
        self.line_thickness = 2

        # กำหนดจุดที่เลือก
        self.selected_points = []
        self.connections = []

        # สร้าง mask เส้นทองแดง
        self.create_wire_mask()

        # สร้าง figure และ axes
        self.fig, self.ax = plt.subplots(figsize=(12, 9))
        plt.subplots_adjust(bottom=0.25)  # ปรับพื้นที่ด้านล่างสำหรับ slider

        # แสดงภาพ
        self.img_display = self.ax.imshow(self.working_image)
        self.fig.canvas.mpl_connect("button_press_event", self.onclick)

        # สร้างปุ่มและ slider
        self.create_controls()

        plt.show()

    def create_controls(self):
        """สร้างปุ่มควบคุมและ slider"""
        # สร้าง slider สำหรับปรับค่า HSV
        ax_hue_min = plt.axes([0.25, 0.15, 0.5, 0.02])
        self.s_hue_min = Slider(ax_hue_min, "Hue Min", 0, 179, valinit=self.hue_min)
        self.s_hue_min.on_changed(self.update_params)

        ax_hue_max = plt.axes([0.25, 0.12, 0.5, 0.02])
        self.s_hue_max = Slider(ax_hue_max, "Hue Max", 0, 179, valinit=self.hue_max)
        self.s_hue_max.on_changed(self.update_params)

        ax_sat_min = plt.axes([0.25, 0.09, 0.5, 0.02])
        self.s_sat_min = Slider(ax_sat_min, "Sat Min", 0, 255, valinit=self.sat_min)
        self.s_sat_min.on_changed(self.update_params)

        ax_value_min = plt.axes([0.25, 0.06, 0.5, 0.02])
        self.s_value_min = Slider(
            ax_value_min, "Value Min", 0, 255, valinit=self.value_min
        )
        self.s_value_min.on_changed(self.update_params)

        # สร้างปุ่มติดตามเส้น
        trackax = plt.axes([0.25, 0.01, 0.15, 0.04])
        self.track_button = Button(
            trackax, "Track Path", color="lightblue", hovercolor="0.975"
        )
        self.track_button.on_clicked(self.track_path)

        # สร้างปุ่มรีเซ็ต
        resetax = plt.axes([0.45, 0.01, 0.15, 0.04])
        self.reset_button = Button(
            resetax, "Reset", color="lightcoral", hovercolor="0.975"
        )
        self.reset_button.on_clicked(self.reset)

        # สร้างปุ่มแสดงผล mask
        maskax = plt.axes([0.65, 0.01, 0.15, 0.04])
        self.mask_button = Button(
            maskax, "Show Mask", color="lightgreen", hovercolor="0.975"
        )
        self.mask_button.on_clicked(self.toggle_mask_view)

        self.show_mask = False

    def update_params(self, val):
        """อัปเดตพารามิเตอร์จาก slider"""
        self.hue_min = int(self.s_hue_min.val)
        self.hue_max = int(self.s_hue_max.val)
        self.sat_min = int(self.s_sat_min.val)
        self.value_min = int(self.s_value_min.val)

        self.create_wire_mask()
        self.draw_points()

    def toggle_mask_view(self, event):
        """สลับระหว่างการแสดงภาพต้นฉบับและ mask"""
        self.show_mask = not self.show_mask
        if self.show_mask:
            # แสดง mask และ skeleton
            mask_display = np.zeros_like(self.image_rgb)
            mask_display[:, :, 1] = self.mask  # แสดง mask ในช่องสีเขียว
            mask_display[:, :, 2] = self.skeleton  # แสดง skeleton ในช่องสีแดง
            self.img_display.set_array(mask_display)
        else:
            # กลับไปแสดงภาพปกติ
            self.draw_points()
        self.fig.canvas.draw_idle()

    def create_wire_mask(self):
        """สร้าง mask สำหรับเส้นทองแดง"""
        # ปรับความคมชัดของภาพ
        img = self.image.copy()
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))

        # แปลงเป็น HSV เพื่อการตรวจจับสีทองแดงที่ดีขึ้น
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

        # ปรับความคมชัดเฉพาะช่อง V
        hsv[:, :, 2] = clahe.apply(hsv[:, :, 2])

        # กำหนดช่วงสีทองแดง (สีเหลือง-ส้ม-ทอง)
        lower_copper = np.array([self.hue_min, self.sat_min, self.value_min])
        upper_copper = np.array([self.hue_max, 255, 255])

        # สร้าง mask
        self.mask = cv2.inRange(hsv, lower_copper, upper_copper)

        # ลบสัญญาณรบกวน
        kernel = np.ones((3, 3), np.uint8)
        self.mask = cv2.morphologyEx(self.mask, cv2.MORPH_OPEN, kernel, iterations=1)
        self.mask = cv2.morphologyEx(self.mask, cv2.MORPH_CLOSE, kernel, iterations=2)

        # สร้าง skeleton
        self.skeleton = self.make_skeleton(self.mask)

        # เพิ่มความกว้างของ skeleton เพื่อให้ง่ายต่อการคลิก
        kernel = np.ones((2, 2), np.uint8)
        self.skeleton = cv2.dilate(self.skeleton, kernel, iterations=1)

    def make_skeleton(self, image):
        """สร้าง skeleton ของเส้นทองแดง"""
        # สร้าง thinning ด้วย Zhang-Suen algorithm
        skeleton = np.zeros(image.shape, np.uint8)
        img = image.copy()

        # ใช้อัลกอริทึม thinning แบบวนซ้ำ
        skel = np.zeros_like(img)
        element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
        done = False

        while not done:
            eroded = cv2.erode(img, element)
            temp = cv2.dilate(eroded, element)
            temp = cv2.subtract(img, temp)
            skel = cv2.bitwise_or(skel, temp)
            img = eroded.copy()

            # ตรวจสอบว่าภาพหายไปหมดแล้วหรือยัง
            zeros = size = img.size - cv2.countNonZero(img)
            if zeros == size:
                done = True

        return skel

    def onclick(self, event):
        """จัดการเหตุการณ์เมื่อคลิกบนภาพ"""
        if event.inaxes != self.ax:
            return

        x, y = int(event.xdata), int(event.ydata)

        # หากแสดงผล mask อยู่ ไม่รับการคลิก
        if self.show_mask:
            return

        # ค้นหาจุดบน skeleton ที่ใกล้ที่สุด (ในรัศมี 10 พิกเซล)
        found = False
        min_dist = float("inf")
        best_point = None

        for i in range(max(0, y - 10), min(self.skeleton.shape[0], y + 11)):
            for j in range(max(0, x - 10), min(self.skeleton.shape[1], x + 11)):
                if self.skeleton[i, j] > 0:
                    dist = np.sqrt((y - i) ** 2 + (x - j) ** 2)
                    if dist < min_dist:
                        min_dist = dist
                        best_point = (j, i)  # บันทึกเป็น (x, y)
                        found = True

        if found and min_dist < 10:
            self.selected_points.append(best_point)
            print(f"เลือกจุดที่ {best_point}")
            self.draw_points()
        else:
            print("ไม่พบเส้นทองแดงในบริเวณนี้ กรุณาคลิกใกล้เส้นทองแดงมากขึ้น")

    def draw_points(self):
        """วาดจุดที่เลือกบนภาพ"""
        self.working_image = self.original_image.copy()

        # วาดเส้นทองแดงทับภาพเดิม (แบบโปร่งใส)
        copper_overlay = np.zeros_like(self.working_image)
        copper_overlay[self.mask > 0] = [0, 255, 0]  # สีเขียว
        self.working_image = cv2.addWeighted(
            self.working_image, 1.0, copper_overlay, 0.3, 0
        )

        # วาดจุดที่เลือก
        for i, (x, y) in enumerate(self.selected_points):
            cv2.circle(self.working_image, (x, y), 8, (255, 0, 0), -1)
            cv2.putText(
                self.working_image,
                str(i + 1),
                (x + 10, y + 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2,
            )

        # วาดเส้นที่เชื่อมต่อแล้ว
        for start, end, path in self.connections:
            for i in range(len(path) - 1):
                pt1, pt2 = path[i], path[i + 1]
                cv2.line(
                    self.working_image, pt1, pt2, (255, 0, 255), self.line_thickness
                )

        self.update_display()

    def track_path(self, event):
        """ติดตามเส้นทางระหว่างจุด"""
        if len(self.selected_points) < 2:
            print("ต้องการอย่างน้อย 2 จุดเพื่อติดตามเส้นทาง")
            return

        # ค้นหาเส้นทางระหว่างจุดคู่สุดท้าย
        start = self.selected_points[-2]
        end = self.selected_points[-1]

        # ตรวจสอบว่าจุดเริ่มต้นและสิ้นสุดอยู่บนเส้น (อาจมีการปรับให้ใกล้เคียงแล้วจากฟังก์ชัน onclick)
        if self.skeleton[start[1], start[0]] == 0 or self.skeleton[end[1], end[0]] == 0:
            print("จุดเริ่มต้นหรือจุดสิ้นสุดไม่อยู่บนเส้นทองแดง กรุณาเลือกใหม่")
            return

        # หาเส้นทางด้วย A* search (ปรับปรุงจาก BFS เพื่อให้ได้เส้นทางที่สั้นกว่า)
        path = self.astar_path(start, end)

        if path:
            self.connections.append((start, end, path))
            print(
                f"พบเส้นทางระหว่างจุด {len(self.selected_points)-1} และ {len(self.selected_points)} ความยาว {len(path)} พิกเซล"
            )

            # คำนวณความยาวเส้นทางในหน่วยพิกเซล
            path_length = 0
            for i in range(len(path) - 1):
                pt1, pt2 = path[i], path[i + 1]
                dist = np.sqrt((pt2[0] - pt1[0]) ** 2 + (pt2[1] - pt1[1]) ** 2)
                path_length += dist

            print(f"ความยาวเส้นทาง: {path_length:.2f} พิกเซล")
            self.draw_points()
        else:
            print("ไม่สามารถหาเส้นทางระหว่างจุดได้ ลองเลือกจุดใหม่ที่อยู่บนเส้นทองแดงเดียวกัน")

    def heuristic(self, a, b):
        """คำนวณระยะทาง Euclidean สำหรับ A*"""
        return np.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)

    def astar_path(self, start, end):
        """ใช้ A* search หาเส้นทางบน skeleton"""
        # สร้างกริดการเยี่ยมชม
        visited = np.zeros_like(self.skeleton, dtype=bool)
        parent = {}

        # คิวสำหรับ A* พร้อมค่า priority (f = g + h)
        # รูปแบบ: (f_score, current_point, g_score)
        open_set = []

        # g_score: ต้นทุนจากจุดเริ่มต้นถึงจุดปัจจุบัน
        g_score = {start: 0}

        # f_score: ค่าประมาณของต้นทุนรวมผ่านจุดปัจจุบัน
        f_score = {start: self.heuristic(start, end)}

        # เริ่มด้วยจุดเริ่มต้น
        import heapq

        heapq.heappush(open_set, (f_score[start], start, 0))

        # กำหนดทิศทางการค้นหา (8 ทิศทาง)
        directions = [
            (-1, -1),
            (-1, 0),
            (-1, 1),
            (0, -1),
            (0, 1),
            (1, -1),
            (1, 0),
            (1, 1),
        ]

        found = False

        while open_set:
            # เลือกจุดที่มี f_score ต่ำที่สุด
            _, current, current_g = heapq.heappop(open_set)

            if current == end:
                found = True
                break

            if visited[current[1], current[0]]:
                continue

            visited[current[1], current[0]] = True

            for dx, dy in directions:
                x, y = current[0] + dx, current[1] + dy

                # ตรวจสอบขอบเขตและว่ายังไม่ได้เยี่ยมชม
                if (
                    0 <= x < self.skeleton.shape[1]
                    and 0 <= y < self.skeleton.shape[0]
                    and self.skeleton[y, x] > 0
                    and not visited[y, x]
                ):

                    # คำนวณระยะทาง (ตรงหรือทแยง)
                    if dx == 0 or dy == 0:
                        step_cost = 1.0  # แนวตรง
                    else:
                        step_cost = 1.414  # แนวทแยง (sqrt(2))

                    # คำนวณ g_score ใหม่
                    tentative_g = current_g + step_cost

                    neighbor = (x, y)
                    if neighbor not in g_score or tentative_g < g_score[neighbor]:
                        # พบเส้นทางที่ดีกว่า
                        parent[neighbor] = current
                        g_score[neighbor] = tentative_g
                        f_score[neighbor] = tentative_g + self.heuristic(neighbor, end)
                        heapq.heappush(
                            open_set, (f_score[neighbor], neighbor, tentative_g)
                        )

        # สร้างเส้นทางย้อนกลับ
        if not found:
            return None

        path = []
        current = end
        while current != start:
            path.append(current)
            current = parent[current]
        path.append(start)
        path.reverse()

        return path

    def reset(self, event):
        """รีเซ็ตทุกอย่าง"""
        self.selected_points = []
        self.connections = []
        self.working_image = self.original_image.copy()
        self.create_wire_mask()
        self.update_display()
        print("รีเซ็ตการเลือกจุดและเส้นทางทั้งหมดแล้ว")

    def update_display(self):
        """อัปเดตภาพแสดงผล"""
        self.img_display.set_array(self.working_image)
        self.fig.canvas.draw_idle()


# เรียกใช้คลาส CopperWireTracker
if __name__ == "__main__":
    try:
        # แทนที่เส้นทางไฟล์ด้วยเส้นทางไฟล์ของภาพ PCB
        tracker = CopperWireTracker("test_functions/testpcb.jpg")
    except ValueError as e:
        print(e)
    except Exception as e:
        print(f"เกิดข้อผิดพลาด: {e}")
