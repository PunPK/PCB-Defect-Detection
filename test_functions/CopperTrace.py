import cv2
import numpy as np
import matplotlib.pyplot as plt


def detect_pcb_traces(image_path):
    # Load the image
    img = cv2.imread(image_path)
    if img is None:
        print(f"Failed to load image: {image_path}")
        return None

    # Convert to RGB for visualization (OpenCV loads as BGR)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # Convert to HSV color space for better gold/copper detection
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # Define range for gold/copper color in HSV
    # These values might need adjustment based on lighting and actual color
    lower_gold = np.array([15, 100, 100])
    upper_gold = np.array([30, 255, 255])

    # Create a mask for gold/copper regions
    mask = cv2.inRange(hsv, lower_gold, upper_gold)

    # Apply some morphological operations to clean up the mask
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    # Find contours in the mask
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Create a copy for drawing
    img_contours = img_rgb.copy()

    # Draw contours on the image
    cv2.drawContours(img_contours, contours, -1, (0, 255, 0), 2)

    # Detect holes (pads)
    # Apply thresholding to detect holes
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)

    # Find hole contours
    hole_contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    # Filter for small, circular contours (likely to be holes)
    holes = []
    for contour in hole_contours:
        area = cv2.contourArea(contour)
        if 10 < area < 100:  # Adjust these thresholds based on hole size
            # Check circularity
            perimeter = cv2.arcLength(contour, True)
            if perimeter > 0:
                circularity = 4 * np.pi * area / (perimeter * perimeter)
                if circularity > 0.7:  # Higher values = more circular
                    M = cv2.moments(contour)
                    if M["m00"] != 0:
                        cx = int(M["m10"] / M["m00"])
                        cy = int(M["m01"] / M["m00"])
                        holes.append((cx, cy))

    # Draw holes on the image
    for hole in holes:
        cv2.circle(img_contours, hole, 5, (255, 0, 0), -1)

    # Create a matrix to represent trace connections between holes
    num_holes = len(holes)
    connections = np.zeros((num_holes, num_holes), dtype=bool)

    # Check which holes are connected by traces
    # This is a simplified approach and may need refinement
    for i in range(num_holes):
        for j in range(i + 1, num_holes):
            # Draw a line between two holes
            line_img = np.zeros_like(mask)
            cv2.line(line_img, holes[i], holes[j], 255, 1)

            # Check if the line overlaps with traces
            overlap = cv2.bitwise_and(line_img, mask)
            overlap_ratio = np.sum(overlap) / np.sum(line_img)

            # If most of the line overlaps with traces, consider them connected
            if overlap_ratio > 0.8:
                connections[i, j] = True
                connections[j, i] = True

    # Draw connections between holes
    img_connections = img_rgb.copy()
    for i in range(num_holes):
        for j in range(i + 1, num_holes):
            if connections[i, j]:
                cv2.line(img_connections, holes[i], holes[j], (0, 0, 255), 2)

    # Visualize the results
    plt.figure(figsize=(15, 10))

    plt.subplot(2, 2, 1)
    plt.imshow(img_rgb)
    plt.title("Original Image")
    plt.axis("off")

    plt.subplot(2, 2, 2)
    plt.imshow(mask, cmap="gray")
    plt.title("Copper Trace Mask")
    plt.axis("off")

    plt.subplot(2, 2, 3)
    plt.imshow(img_contours)
    plt.title("Detected Traces and Holes")
    plt.axis("off")

    plt.subplot(2, 2, 4)
    plt.imshow(img_connections)
    plt.title("Identified Connections")
    plt.axis("off")

    plt.tight_layout()
    plt.show()

    return {
        "original": img_rgb,
        "mask": mask,
        "contours": img_contours,
        "connections": img_connections,
        "holes": holes,
        "connections_matrix": connections,
    }


# Advanced trace extraction method using skeletonization
def extract_pcb_traces_skeleton(image_path):
    # Load the image
    img = cv2.imread(image_path)
    if img is None:
        print(f"Failed to load image: {image_path}")
        return None

    # Convert to RGB for visualization
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # Convert to HSV color space for better gold/copper detection
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # Define range for gold/copper color in HSV
    lower_gold = np.array([15, 100, 100])
    upper_gold = np.array([30, 255, 255])

    # Create a mask for gold/copper regions
    mask = cv2.inRange(hsv, lower_gold, upper_gold)

    # Apply morphological operations
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    # Skeletonize the traces
    skeleton = np.zeros(mask.shape, np.uint8)
    temp = np.zeros(mask.shape, np.uint8)

    # Apply skeletonization
    mask_copy = mask.copy()
    while True:
        # Step 1: Erosion
        eroded = cv2.erode(mask_copy, kernel)

        # Step 2: Opening
        temp = cv2.morphologyEx(eroded, cv2.MORPH_OPEN, kernel)

        # Step 3: Subtract (eroded - opened)
        temp = cv2.subtract(eroded, temp)

        # Step 4: Add to skeleton
        skeleton = cv2.bitwise_or(skeleton, temp)

        # Step 5: Update mask_copy
        mask_copy = eroded.copy()

        # Step 6: Check if eroded is empty
        if cv2.countNonZero(eroded) == 0:
            break

    # Detect holes/pads
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)

    hole_contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    holes = []
    for contour in hole_contours:
        area = cv2.contourArea(contour)
        if 10 < area < 100:  # Adjust based on hole size
            perimeter = cv2.arcLength(contour, True)
            if perimeter > 0:
                circularity = 4 * np.pi * area / (perimeter * perimeter)
                if circularity > 0.7:
                    M = cv2.moments(contour)
                    if M["m00"] != 0:
                        cx = int(M["m10"] / M["m00"])
                        cy = int(M["m01"] / M["m00"])
                        holes.append((cx, cy))

    # Visualize results
    plt.figure(figsize=(15, 10))

    plt.subplot(2, 2, 1)
    plt.imshow(img_rgb)
    plt.title("Original Image")
    plt.axis("off")

    plt.subplot(2, 2, 2)
    plt.imshow(mask, cmap="gray")
    plt.title("Copper Trace Mask")
    plt.axis("off")

    plt.subplot(2, 2, 3)
    plt.imshow(skeleton, cmap="gray")
    plt.title("Trace Skeleton")
    plt.axis("off")

    # Draw holes on the skeleton image
    skeleton_rgb = cv2.cvtColor(skeleton, cv2.COLOR_GRAY2RGB)
    for hole in holes:
        cv2.circle(skeleton_rgb, hole, 5, (255, 0, 0), -1)

    plt.subplot(2, 2, 4)
    plt.imshow(skeleton_rgb)
    plt.title("Skeleton with Holes")
    plt.axis("off")

    plt.tight_layout()
    plt.show()

    return {
        "original": img_rgb,
        "mask": mask,
        "skeleton": skeleton,
        "skeleton_with_holes": skeleton_rgb,
        "holes": holes,
    }


# Example usage
if __name__ == "__main__":
    # Replace with your PCB image path
    image_path = "test_functions/testpcb.jpg"

    # Method 1: Simple contour-based detection
    results = detect_pcb_traces(image_path)

    # Method 2: Skeleton-based detection (more precise for trace paths)
    skeleton_results = extract_pcb_traces_skeleton(image_path)

    print(f"Detected {len(results['holes'])} holes/pads on the PCB")

    # Advanced: Trace each path from hole to hole
    # This would require more sophisticated path-finding algorithms
