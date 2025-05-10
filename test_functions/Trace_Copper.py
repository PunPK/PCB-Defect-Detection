import cv2
import numpy as np
import matplotlib.pyplot as plt
from skimage import measure
from skimage.morphology import disk, closing, opening, dilation
import random

# Load the image
image_path = "test_functions/testpcb.jpg"  # Update this path as needed
image_pcb = cv2.imread(image_path)

if image_pcb is None:
    print(f"Error: Could not load image from {image_path}")
else:
    # Convert to RGB for display
    image_rgb = cv2.cvtColor(image_pcb, cv2.COLOR_BGR2RGB)

    # Convert to HSV for better color segmentation
    hsv = cv2.cvtColor(image_pcb, cv2.COLOR_BGR2HSV)

    # Define range for copper/gold color (golden yellow)
    lower_copper = np.array([15, 50, 100])
    upper_copper = np.array([30, 255, 255])

    # Create mask for copper
    copper_mask = cv2.inRange(hsv, lower_copper, upper_copper)

    # Apply morphological operations to clean up the mask
    kernel = np.ones((3, 3), np.uint8)
    copper_mask = cv2.morphologyEx(copper_mask, cv2.MORPH_OPEN, kernel, iterations=1)
    copper_mask = cv2.morphologyEx(copper_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    # Label connected components in the mask
    labels = measure.label(copper_mask, connectivity=2)
    props = measure.regionprops(labels)

    # Filter small regions (noise)
    min_area = 50  # Adjust this threshold as needed
    filtered_mask = np.zeros_like(copper_mask)
    for prop in props:
        if prop.area >= min_area:
            filtered_mask[labels == prop.label] = 255

    # Display original mask and filtered mask
    plt.figure(figsize=(15, 10))
    plt.subplot(2, 2, 1), plt.imshow(image_rgb), plt.title("Original PCB")
    plt.subplot(2, 2, 2), plt.imshow(copper_mask, cmap="gray"), plt.title("Copper Mask")
    plt.subplot(2, 2, 3), plt.imshow(filtered_mask, cmap="gray"), plt.title(
        "Filtered Copper Mask"
    )

    # Create an RGB version of the image with only the copper traces
    copper_only = cv2.bitwise_and(image_rgb, image_rgb, mask=filtered_mask)
    plt.subplot(2, 2, 4), plt.imshow(copper_only), plt.title("Copper Traces Only")
    plt.tight_layout()
    plt.show()

    # Now extract individual traces
    # Dilate to merge closely connected traces
    dilated = dilation(filtered_mask, disk(1))

    # Label connected components again
    labels = measure.label(dilated, connectivity=2)
    num_traces = labels.max()

    # Create colorful visualization of individual traces
    trace_colors = np.zeros((*labels.shape, 3), dtype=np.uint8)

    # Generate random colors for each trace
    colors = []
    for i in range(num_traces + 1):
        if i == 0:  # Background
            colors.append([0, 0, 0])
        else:
            colors.append(
                [
                    random.randint(50, 255),
                    random.randint(50, 255),
                    random.randint(50, 255),
                ]
            )

    # Assign colors to each trace
    for i in range(num_traces + 1):
        trace_colors[labels == i] = colors[i]

    # Display individual traces with unique colors
    plt.figure(figsize=(15, 10))
    plt.subplot(1, 2, 1), plt.imshow(image_rgb), plt.title("Original PCB")
    plt.subplot(1, 2, 2), plt.imshow(trace_colors), plt.title(
        f"Identified Traces (Total: {num_traces})"
    )
    plt.tight_layout()
    plt.show()

    # Display some individual traces
    plt.figure(figsize=(15, 10))
    num_to_show = min(8, num_traces)
    trace_indices = sorted(
        range(1, num_traces + 1), key=lambda x: np.sum(labels == x), reverse=True
    )[:num_to_show]

    for i, trace_idx in enumerate(trace_indices):
        single_trace = np.zeros_like(filtered_mask)
        single_trace[labels == trace_idx] = 255

        # Apply the mask to the original image
        trace_rgb = cv2.bitwise_and(
            image_rgb, image_rgb, mask=single_trace.astype(np.uint8)
        )

        plt.subplot(2, 4, i + 1)
        plt.imshow(trace_rgb)
        plt.title(f"Trace #{trace_idx}")
        plt.axis("off")

    plt.tight_layout()
    plt.show()

    # Extract the largest traces and show them individually
    print(f"Found {num_traces} copper traces in the PCB image")
    print("Displaying the largest individual traces:")

    # Calculate area of each trace
    trace_areas = []
    for i in range(1, num_traces + 1):
        area = np.sum(labels == i)
        trace_areas.append((i, area))

    # Sort traces by area (largest first)
    trace_areas.sort(key=lambda x: x[1], reverse=True)

    # Display top 5 largest traces individually
    plt.figure(figsize=(15, 10))
    for i in range(min(5, len(trace_areas))):
        trace_idx, area = trace_areas[i]
        single_trace = np.zeros_like(filtered_mask)
        single_trace[labels == trace_idx] = 255

        # Apply the mask to the original image
        trace_rgb = cv2.bitwise_and(
            image_rgb, image_rgb, mask=single_trace.astype(np.uint8)
        )

        plt.subplot(1, 5, i + 1)
        plt.imshow(trace_rgb)
        plt.title(f"Trace {i+1}\nArea: {area}")
        plt.axis("off")

    plt.tight_layout()
    plt.show()
