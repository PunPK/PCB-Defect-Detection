import cv2
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.widgets import Button
from collections import deque

class CopperWireTracker:
    def __init__(self, image_path):
        # โหลดภาพ
        self.image = cv2.imread(image_path)
        if self.image is None:
            raise ValueError("ไม่สามารถโหลดภาพได้ กรุณาตรวจสอบ路径")
            
        self.image_rgb = cv2.cvtColor(self.image, cv2.COLOR_BGR2RGB)
        self.working_image = self.image_rgb.copy()
        
        # กำหนดจุดที่เลือก
        self.selected_points = []
        self.connections = []
        
        # สร้าง mask เส้นทองแดง
        self.create_wire_mask()
        
        # สร้าง figure และ axes
        self.fig, self.ax = plt.subplots(figsize=(10, 8))
        plt.subplots_adjust(bottom=0.15)
        
        # แสดงภาพ
        self.img_display = self.ax.imshow(self.working_image)
        self.fig.canvas.mpl_connect('button_press_event', self.onclick)
        
        # สร้างปุ่มติดตามเส้น
        trackax = plt.axes([0.3, 0.05, 0.2, 0.05])
        self.track_button = Button(trackax, 'Track Path', hovercolor='0.975')
        self.track_button.on_clicked(self.track_path)
        
        # สร้างปุ่มรีเซ็ต
        resetax = plt.axes([0.6, 0.05, 0.2, 0.05])
        self.reset_button = Button(resetax, 'Reset', hovercolor='0.975')
        self.reset_button.on_clicked(self.reset)
        
        plt.show()
    
    def create_wire_mask(self):
        """สร้าง mask สำหรับเส้นทองแดง"""
        hsv = cv2.cvtColor(self.image, cv2.COLOR_BGR2HSV)
        lower_copper = np.array([10, 100, 100])
        upper_copper = np.array([20, 255, 255])
        self.mask = cv2.inRange(hsv, lower_copper, upper_copper)
        
        # ปรับปรุง mask
        kernel = np.ones((3,3), np.uint8)
        self.mask = cv2.morphologyEx(self.mask, cv2.MORPH_OPEN, kernel, iterations=2)
        self.mask = cv2.morphologyEx(self.mask, cv2.MORPH_CLOSE, kernel, iterations=2)
        
        # สร้าง skeleton โดยไม่ใช้ ximgproc
        self.skeleton = self.make_skeleton(self.mask)
    
    def make_skeleton(self, image):
        """สร้าง skeleton ด้วยวิธีทางเลือก"""
        size = np.size(image)
        skel = np.zeros(image.shape, np.uint8)
        
        element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3,3))
        while True:
            eroded = cv2.erode(image, element)
            temp = cv2.dilate(eroded, element)
            temp = cv2.subtract(image, temp)
            skel = cv2.bitwise_or(skel, temp)
            image = eroded.copy()
            
            if cv2.countNonZero(image) == 0:
                break
                
        return skel
    
    def onclick(self, event):
        """จัดการเหตุการณ์เมื่อคลิกบนภาพ"""
        if event.inaxes != self.ax:
            return
        
        x, y = int(event.xdata), int(event.ydata)
        
        # ตรวจสอบว่าคลิกบนเส้นทองแดงหรือไม่
        if self.skeleton[y, x] == 255:
            self.selected_points.append((x, y))
            self.draw_points()
        else:
            print("กรุณาคลิกบนเส้นทองแดงเท่านั้น")
    
    def draw_points(self):
        """วาดจุดที่เลือกบนภาพ"""
        self.working_image = self.image_rgb.copy()
        
        # วาดเส้นทองแดง
        self.working_image[self.skeleton > 0] = [0, 255, 0]
        
        # วาดจุดที่เลือก
        for i, (x, y) in enumerate(self.selected_points):
            cv2.circle(self.working_image, (x, y), 8, (255, 0, 0), -1)
            cv2.putText(self.working_image, str(i+1), (x+10, y+10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2)
        
        # วาดเส้นที่เชื่อมต่อแล้ว
        for (pt1, pt2) in self.connections:
            cv2.line(self.working_image, pt1, pt2, (255, 0, 255), 2)
        
        self.update_display()
    
    def track_path(self, event):
        """ติดตามเส้นทางระหว่างจุด"""
        if len(self.selected_points) < 2:
            print("ต้องการอย่างน้อย 2 จุดเพื่อติดตามเส้นทาง")
            return
        
        # ค้นหาเส้นทางระหว่างจุดคู่สุดท้าย
        start = self.selected_points[-2]
        end = self.selected_points[-1]
        
        # ตรวจสอบว่าจุดเริ่มต้นและสิ้นสุดอยู่บนเส้น
        if self.skeleton[start[1], start[0]] != 255 or self.skeleton[end[1], end[0]] != 255:
            print("จุดเริ่มต้นหรือจุดสิ้นสุดไม่อยู่บนเส้นทองแดง")
            return
        
        # หาเส้นทางด้วย BFS
        path = self.bfs_path(start, end)
        
        if path:
            self.connections.append((start, end))
            print(f"พบเส้นทางระหว่างจุด {len(self.selected_points)-1} และ {len(self.selected_points)}")
            
            # วาดเส้นทางที่พบ
            for i in range(len(path)-1):
                cv2.line(self.working_image, path[i], path[i+1], (255, 0, 255), 2)
        else:
            print("ไม่สามารถหาเส้นทางระหว่างจุดได้")
        
        self.update_display()
    
    def bfs_path(self, start, end):
        """ใช้ BFS หาเส้นทางบน skeleton"""
        # สร้างกริดการเยี่ยมชม
        visited = np.zeros_like(self.skeleton, dtype=bool)
        parent = {}
        
        # กำหนดทิศทางการค้นหา (8 ทิศทาง)
        directions = [(-1,-1), (-1,0), (-1,1),
                      (0,-1),          (0,1),
                      (1,-1),  (1,0),  (1,1)]
        
        queue = deque()
        queue.append(start)
        visited[start[1], start[0]] = True
        found = False
        
        while queue:
            current = queue.popleft()
            
            if current == end:
                found = True
                break
            
            for dx, dy in directions:
                x, y = current[0] + dx, current[1] + dy
                
                # ตรวจสอบขอบเขตและว่ายังไม่ได้เยี่ยมชม
                if (0 <= x < self.skeleton.shape[1] and 
                    0 <= y < self.skeleton.shape[0] and 
                    self.skeleton[y, x] == 255 and 
                    not visited[y, x]):
                    
                    visited[y, x] = True
                    parent[(x, y)] = current
                    queue.append((x, y))
        
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
        self.working_image = self.image_rgb.copy()
        self.create_wire_mask()
        self.update_display()
        print("รีเซ็ตทั้งหมดแล้ว")
    
    def update_display(self):
        """อัปเดตภาพแสดงผล"""
        self.img_display.set_array(self.working_image)
        self.fig.canvas.draw_idle()

# เรียกใช้คลาส CopperWireTracker
try:
    tracker = CopperWireTracker("test_functions/hole_test.png")
except ValueError as e:
    print(e)
except Exception as e:
    print(f"เกิดข้อผิดพลาด: {e}")