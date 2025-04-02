import cv2


image = cv2.imread('test_functions/test.png')
print(type(image)) # <class 'numpy.ndarray'>
print(image.shape) # (224, 224, 3)

b, g, r = image[46, 46]
print(b, g, r) # 152 222 148

cv2.imshow('SimpleSat Logo', image)
cv2.waitKey(0)