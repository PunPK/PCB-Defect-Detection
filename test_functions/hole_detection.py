import cv2
import numpy as np
import matplotlib.pyplot as plt


def detect_pcb_holes_improved(image_path):
    """
    Function to detect small holes/pads on a PCB image while excluding large corner mounting holes.

    Args:
        image_path (str): Path to the PCB image

    Returns:
        dict: Dictionary containing the original image, processed images, and hole coordinates
    """
    # Load the image
    img = cv2.imread(image_path)
    if img is None:
        print(f"Failed to load image: {image_path}")
        return None

    # Get image dimensions
    height, width = img.shape[:2]

    # Convert to RGB for visualization (OpenCV loads as BGR)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # Create a copy of the original image for drawing
    img_with_holes = img_rgb.copy()

    # Convert to HSV color space for better gold/copper detection
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # Create a mask specifically for gold/copper areas
    # Adjust these ranges based on your specific PCB color
    lower_gold = np.array([15, 40, 100])
    upper_gold = np.array([35, 255, 255])
    gold_mask = cv2.inRange(hsv, lower_gold, upper_gold)

    # Apply morphological operations to enhance hole detection
    kernel = np.ones((3, 3), np.uint8)
    gold_mask = cv2.morphologyEx(gold_mask, cv2.MORPH_CLOSE, kernel)

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Apply multiple thresholding techniques to catch all possible holes
    # 1. Standard binary threshold for bright areas
    _, binary_bright = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY)

    # 2. Adaptive threshold to handle varying lighting
    adaptive_threshold = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )

    # 3. Use gold mask to refine the search areas
    # Find bright spots within gold areas (likely to be holes)
    combined_mask = cv2.bitwise_and(binary_bright, gold_mask)

    # Find contours in the binary image
    contours, _ = cv2.findContours(
        combined_mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE
    )

    # Also find contours in the adaptive threshold image
    contours_adaptive, _ = cv2.findContours(
        adaptive_threshold, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE
    )

    # Combine both contour sets
    all_contours = contours + contours_adaptive

    # Define a corner margin to exclude large corner holes
    corner_margin = min(width, height) // 10

    # List to store hole coordinates
    holes = []

    # Create an empty mask to keep track of detected holes
    # This helps prevent duplicate detections
    hole_mask = np.zeros((height, width), dtype=np.uint8)

    # Process each contour to identify holes
    min_area = 5  # Minimum area to be considered a hole
    max_area = 100  # Maximum area for small holes (excludes corner mount holes)
    circularity_threshold = 0.6  # Lower threshold to catch more potential holes

    for contour in all_contours:
        # Calculate contour area
        area = cv2.contourArea(contour)

        # Filter by area to exclude very small noise and large mounting holes
        if min_area < area < max_area:
            # Calculate circularity
            perimeter = cv2.arcLength(contour, True)
            if perimeter > 0:
                circularity = 4 * np.pi * area / (perimeter * perimeter)

                # Filter by circularity to only keep circular shapes
                if circularity > circularity_threshold:
                    # Calculate centroid of the contour
                    M = cv2.moments(contour)
                    if M["m00"] != 0:
                        cx = int(M["m10"] / M["m00"])
                        cy = int(M["m01"] / M["m00"])

                        # Check if this is a corner hole (large mounting hole)
                        is_corner_hole = False

                        # Check if hole is near any corner
                        if (
                            (cx < corner_margin and cy < corner_margin)  # Top-left
                            or (
                                cx < corner_margin and cy > height - corner_margin
                            )  # Bottom-left
                            or (
                                cx > width - corner_margin and cy < corner_margin
                            )  # Top-right
                            or (
                                cx > width - corner_margin
                                and cy > height - corner_margin
                            )
                        ):  # Bottom-right

                            # If it's a larger hole in the corner, skip it
                            if area > 50:  # Typical size for mounting holes
                                is_corner_hole = True

                        # If it's not a corner hole and not already detected
                        if not is_corner_hole and hole_mask[cy, cx] == 0:
                            # Check if we already have a hole very close to this one
                            is_duplicate = False
                            for existing_cx, existing_cy in holes:
                                distance = np.sqrt(
                                    (cx - existing_cx) ** 2 + (cy - existing_cy) ** 2
                                )
                                if (
                                    distance < 10
                                ):  # If closer than 10 pixels, consider it a duplicate
                                    is_duplicate = True
                                    break

                            if not is_duplicate:
                                # Add hole coordinates to our list
                                holes.append((cx, cy))

                                # Mark this area as detected in our mask
                                cv2.circle(hole_mask, (cx, cy), 5, 255, -1)

                                # Draw the hole on our image copy
                                cv2.circle(img_with_holes, (cx, cy), 5, (255, 0, 0), 2)

                                # Add hole number for reference
                                cv2.putText(
                                    img_with_holes,
                                    str(len(holes)),
                                    (cx + 5, cy + 5),
                                    cv2.FONT_HERSHEY_SIMPLEX,
                                    0.4,
                                    (255, 0, 0),
                                    1,
                                )

    # Create a completely blank image to show just the holes
    holes_only = np.zeros_like(img_rgb)
    for i, (cx, cy) in enumerate(holes):
        # Draw the hole as a red circle (similar to the input image marking)
        cv2.circle(holes_only, (cx, cy), 8, (255, 0, 0), 2)
        # Add hole number
        cv2.putText(
            holes_only,
            str(i + 1),
            (cx + 10, cy),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 0, 0),
            1,
        )

    # Visualize the results
    plt.figure(figsize=(15, 10))

    plt.subplot(2, 2, 1)
    plt.imshow(img_rgb)
    plt.title("Original PCB Image")
    plt.axis("off")

    plt.subplot(2, 2, 2)
    plt.imshow(combined_mask, cmap="gray")
    plt.title("Combined Mask")
    plt.axis("off")

    plt.subplot(2, 2, 3)
    plt.imshow(img_with_holes)
    plt.title(f"Detected Holes: {len(holes)}")
    plt.axis("off")

    plt.subplot(2, 2, 4)
    plt.imshow(holes_only)
    plt.title("Holes Only (Numbered)")
    plt.axis("off")

    plt.tight_layout()
    plt.show()

    print(
        f"Detected {len(holes)} holes in the PCB image (excluding corner mounting holes)"
    )
    print("Hole coordinates (x, y):")
    for i, hole in enumerate(holes):
        print(f"Hole {i+1}: {hole}")

    return {
        "original": img_rgb,
        "combined_mask": combined_mask,
        "holes_detected": img_with_holes,
        "holes_only": holes_only,
        "hole_coordinates": holes,
        "hole_count": len(holes),
    }


def detect_holes_with_parameters(
    image_path,
    min_area=5,
    max_area=100,
    circularity_threshold=0.6,
    corner_exclusion=True,
    color_lower=None,
    color_upper=None,
):
    """
    Highly customizable function to detect holes with adjustable parameters.

    Args:
        image_path (str): Path to the PCB image
        min_area (int): Minimum contour area to consider as a hole
        max_area (int): Maximum contour area to consider as a hole
        circularity_threshold (float): Minimum circularity value (0-1) to consider as a hole
        corner_exclusion (bool): Whether to exclude corner mounting holes
        color_lower (array): Lower HSV color range for hole detection, default gold/copper
        color_upper (array): Upper HSV color range for hole detection, default gold/copper

    Returns:
        dict: Dictionary containing the original image, processed images, and hole coordinates
    """
    # Load the image
    img = cv2.imread(image_path)
    if img is None:
        print(f"Failed to load image: {image_path}")
        return None

    # Get image dimensions
    height, width = img.shape[:2]

    # Convert to RGB for visualization
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # Create a copy for drawing
    img_with_holes = img_rgb.copy()

    # Convert to HSV color space
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # Set default color range for gold/copper if not provided
    if color_lower is None:
        color_lower = np.array([15, 40, 100])
    if color_upper is None:
        color_upper = np.array([35, 255, 255])

    # Create color mask
    color_mask = cv2.inRange(hsv, color_lower, color_upper)

    # Apply morphological operations
    kernel = np.ones((3, 3), np.uint8)
    color_mask = cv2.morphologyEx(color_mask, cv2.MORPH_CLOSE, kernel)

    # Get grayscale image
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Apply thresholding
    _, binary = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY)

    # Combine masks
    combined_mask = cv2.bitwise_and(binary, color_mask)

    # Find contours
    contours, _ = cv2.findContours(
        combined_mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE
    )

    # Define corner margin for exclusion
    corner_margin = min(width, height) // 10

    # List for hole coordinates
    holes = []

    # Tracking mask for detected holes
    hole_mask = np.zeros((height, width), dtype=np.uint8)

    # Process contours
    for contour in contours:
        area = cv2.contourArea(contour)

        if min_area < area < max_area:
            perimeter = cv2.arcLength(contour, True)
            if perimeter > 0:
                circularity = 4 * np.pi * area / (perimeter * perimeter)

                if circularity > circularity_threshold:
                    M = cv2.moments(contour)
                    if M["m00"] != 0:
                        cx = int(M["m10"] / M["m00"])
                        cy = int(M["m01"] / M["m00"])

                        # Corner exclusion logic
                        skip_hole = False
                        if corner_exclusion:
                            if (
                                (cx < corner_margin and cy < corner_margin)
                                or (cx < corner_margin and cy > height - corner_margin)
                                or (cx > width - corner_margin and cy < corner_margin)
                                or (
                                    cx > width - corner_margin
                                    and cy > height - corner_margin
                                )
                            ):

                                if area > 50:
                                    skip_hole = True

                        # Check for duplicates
                        if not skip_hole and hole_mask[cy, cx] == 0:
                            is_duplicate = False
                            for existing_cx, existing_cy in holes:
                                distance = np.sqrt(
                                    (cx - existing_cx) ** 2 + (cy - existing_cy) ** 2
                                )
                                if distance < 10:
                                    is_duplicate = True
                                    break

                            if not is_duplicate:
                                holes.append((cx, cy))
                                cv2.circle(hole_mask, (cx, cy), 5, 255, -1)
                                cv2.circle(img_with_holes, (cx, cy), 5, (255, 0, 0), 2)
                                cv2.putText(
                                    img_with_holes,
                                    str(len(holes)),
                                    (cx + 5, cy + 5),
                                    cv2.FONT_HERSHEY_SIMPLEX,
                                    0.4,
                                    (255, 0, 0),
                                    1,
                                )

    # Create holes-only image
    holes_only = np.zeros_like(img_rgb)
    for i, (cx, cy) in enumerate(holes):
        cv2.circle(holes_only, (cx, cy), 8, (255, 0, 0), 2)
        cv2.putText(
            holes_only,
            str(i + 1),
            (cx + 10, cy),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 0, 0),
            1,
        )

    # Visualize
    plt.figure(figsize=(15, 10))

    plt.subplot(2, 2, 1)
    plt.imshow(img_rgb)
    plt.title("Original PCB Image")
    plt.axis("off")

    plt.subplot(2, 2, 2)
    plt.imshow(combined_mask, cmap="gray")
    plt.title("Combined Mask")
    plt.axis("off")

    plt.subplot(2, 2, 3)
    plt.imshow(img_with_holes)
    plt.title(f"Detected Holes: {len(holes)}")
    plt.axis("off")

    plt.subplot(2, 2, 4)
    plt.imshow(holes_only)
    plt.title("Holes Only (Numbered)")
    plt.axis("off")

    plt.tight_layout()
    plt.show()

    print(f"Detected {len(holes)} holes with parameters:")
    print(f"- Min area: {min_area}")
    print(f"- Max area: {max_area}")
    print(f"- Circularity threshold: {circularity_threshold}")
    print(f"- Corner exclusion: {corner_exclusion}")

    return {
        "original": img_rgb,
        "combined_mask": combined_mask,
        "holes_detected": img_with_holes,
        "holes_only": holes_only,
        "hole_coordinates": holes,
        "hole_count": len(holes),
    }


# Example usage
if __name__ == "__main__":
    # Replace with your PCB image path
    image_path = "test_functions/testpcb.jpg"

    # Basic improved detection (excludes corner mounting holes)
    results = detect_pcb_holes_improved(image_path)

    # For more fine-tuned control, uncomment and adjust parameters:
    # custom_results = detect_holes_with_parameters(
    #     image_path,
    #     min_area=3,                # Smaller to detect tiny holes
    #     max_area=80,               # Smaller to exclude mounting holes
    #     circularity_threshold=0.5, # Lower to catch less perfect circles
    #     corner_exclusion=True,     # Set to False if you want corner holes
    #     # Custom color range for gold/copper detection if needed:
    #     # color_lower=np.array([10, 30, 100]),
    #     # color_upper=np.array([40, 255, 255])
    # )

    # The coordinates of all detected holes are available in results['hole_coordinates']
    # You can export these coordinates to a file if needed:
    # with open('hole_coordinates.txt', 'w') as f:
    #     for i, (x, y) in enumerate(results['hole_coordinates']):
    #         f.write(f"Hole {i+1}: {x}, {y}\n")
