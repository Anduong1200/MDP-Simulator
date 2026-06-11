# GridWorld Visualizer

Một phần mềm mô phỏng trực quan các thuật toán cốt lõi của **Reinforcement Learning** (dựa theo sách *Reinforcement Learning: An Introduction* - Sutton & Barto, Chapter 3 & 4), tập trung vào bài toán Markov Decision Process (MDP) hữu hạn.

## Tính năng chính
### Các tính năng cốt lõi

## Phần I: Tabular Methods
- **Mô phỏng Môi trường (Environment)**: Tạo Grid tùy chỉnh kích thước, đặt các vật cản (Blocked), Terminal States có thưởng/phạt, và vị trí xuất phát (Start).
- **Môi trường Deterministic & Stochastic**: Cho phép điều chỉnh tỉ lệ trượt (Slip probability) của Agent. Mặc định Agent chọn đi thẳng nhưng có thể cấu hình để có xác suất bị trượt sang hai bên.
- **Dynamic Programming (Model-Based)**: 
  - **Value Iteration & Policy Iteration**: Trực quan hóa từng bước hội tụ (sweep) bằng hiệu ứng Animation thời gian thực. Hỗ trợ đầy đủ **Asynchronous Dynamic Programming** (Gauss-Seidel in-place updates) giúp tăng tốc độ hội tụ.
  - **Generalized Policy Iteration (GPI)**: Thay đổi số lượng vòng lặp Policy Evaluation ($k$) tối đa để mô phỏng sự dịch chuyển mượt mà giữa Value Iteration và Policy Iteration.
  - **Đánh giá Policy (Policy Evaluation)**: Vẽ tay một Policy bất kỳ và giải phương trình Bellman Expectation để tìm Value function $V_\pi(s)$.
- **Monte Carlo Methods (Episodic Model-Free)**: Mô phỏng phương pháp học thông qua kinh nghiệm từ từng Episode hoàn chỉnh.
  - **On-policy MC Control**: Học giá trị và tối ưu Policy dựa trên chính sách đang sử dụng (First-visit MC).
  - **Off-policy MC Control**: Học Policy tối ưu từ các tập kinh nghiệm sinh ra bởi Behavior Policy ngẫu nhiên thông qua Weighted Importance Sampling.
- **n-step Bootstrapping**: Cầu nối giữa Monte Carlo và TD Learning.
  - **n-step SARSA**: Mở rộng của SARSA với phần thưởng kéo dài n-bước.
  - **Tree Backup Algorithm**: Thuật toán Off-policy an toàn, loại bỏ phương sai cao mà không cần dùng đến Importance Sampling.
- **Planning & Learning (Dyna Architecture)**: Kết hợp hoàn hảo giữa Model-Free (Học thực tế) và Model-Based (Tưởng tượng).
  - **Dyna-Q**: Tại mỗi bước đi thực tế, thực hiện nội suy thêm $n$ bước "tưởng tượng" (Planning Steps) từ các trải nghiệm trong quá khứ để tăng tốc độ hội tụ.
  - **Prioritized Sweeping**: Phiên bản tối ưu của Dyna-Q. Duy trì một Hàng đợi ưu tiên (Priority Queue) để chỉ quét (sweep) những trạng thái có độ chênh lệch Q-Value cao nhất, giúp lan truyền phần thưởng về đích cực kì nhanh.
- **Temporal-Difference Learning (Step-by-step Model-Free)**: Mô phỏng quá trình Agent tự học thông qua tương tác trực tiếp với môi trường (Trial and Error). Hỗ trợ đầy đủ các thuật toán cốt lưỡng của Chapter 6:
  - **Q-Learning** (Off-policy TD Control)
  - **SARSA** (On-policy TD Control)
  - **Expected SARSA**
  - **Double Q-Learning**: Giảm thiểu Maximization Bias bằng cách dùng 2 bảng Q riêng biệt.

## Part II: Approximate Solution Methods

Từ môi trường rời rạc nhỏ hẹp, Agent bước vào thế giới thực nơi không thể lưu trữ toàn bộ giá trị trong Q-Table. Các thuật toán Approximate Method thay thế Table bằng **Function Approximation** (thông qua Weights Vector $w$).

- [x] **Chapter 9: On-policy Prediction with Approximation**
  - Semi-gradient TD(0) Prediction.
  - Hỗ trợ các đặc trưng (Features): Coordinate-based (Cơ bản) và Tile Coding (Lưới xếp chồng).
- [x] **Chapter 10: On-policy Control with Approximation**
  - Episodic Semi-gradient SARSA.
  - Tích hợp biểu đồ thống kê (Learning Curve) để quan sát sự hội tụ của Reward (Tổng phần thưởng mỗi Episode). Giúp theo dõi quá trình học theo thời gian thực.
- [ ] **Chapter 11: Off-policy Methods with Approximation** *(Sắp ra mắt)*
  - Khảo sát sự sụp đổ của "The Deadly Triad".
  - Thuật toán Gradient-TD (TDC/GTD2).
  - **Tính năng trích xuất đặc trưng (Feature Construction)**:
    - **Tọa độ tuyến tính**: Môi trường học từ $x, y$.
    - **Tile Coding**: Phương pháp kinh điển của RL. Sử dụng các lưới thưa (tiles) xếp chồng lên nhau để mô phỏng sự tương đồng về không gian. Tốc độ lan truyền kiến thức cực nhanh!

## Part III: Eligibility Traces & Policy Gradients

- **Chapter 12: Eligibility Traces**
  - Kết hợp sức mạnh của n-step bootstrapping và Monte Carlo thông qua cơ chế vết (Trace).
  - Hỗ trợ **TD(λ)** và **Sarsa(λ)**.
  - Tùy chỉnh loại vết: Accumulating Traces (Cộng dồn) hoặc Replacing Traces (Thay thế).
- **Chapter 13: Policy Gradient Methods**
  - Tối ưu hóa trực tiếp hàm chính sách $\pi(a|s)$ thông qua Gradient Ascent thay vì ước lượng Q-Value.
  - **REINFORCE**: Policy Gradient cơ bản cập nhật ở cuối mỗi Episode.
  - **REINFORCE with Baseline**: Giảm phương sai thông qua việc sử dụng Value function $V(s)$ làm Baseline.
  - **One-step Actor-Critic**: Cập nhật Online từng bước, kết hợp sự ưu việt của Temporal-Difference và Policy Gradients.

## Part IV: Frontiers & Advanced Topics
- **Chapter 17: Frontiers (Hierarchical RL)**
  - **Options Framework**: Mô phỏng khái niệm "Macro-actions" hay Options. Agent học cách sử dụng các bộ kỹ năng chuỗi thay vì chỉ các hành động nguyên thủy (Up, Down, Left, Right). Khám phá không gian trạng thái nhanh hơn trong các bài toán phòng ốc phức tạp.

## Công nghệ sử dụng
- **HTML5, CSS3, JavaScript (Vanilla)**: Hoàn toàn không cần cài đặt Node.js hay bất kỳ Framework nào.
- **MathJax**: Tích hợp để hiển thị các công thức toán học chuẩn LaTeX ngay trên giao diện.
- **Chart.js**: Vẽ đồ thị Learning Curve (Reward vs Episode) thời gian thực, trực quan hóa quá trình hội tụ học tập của Agent theo chuẩn công nghiệp.

## Cách sử dụng
1. Mở trực tiếp file `index.html` bằng trình duyệt web của bạn (Chrome, Edge, Firefox...).
2. Thiết lập thông số Grid (Rows/Cols) và nhấn **Tạo Grid**. Một bảng **Analytics & Logs** (chứa biểu đồ học tập) sẽ xuất hiện ở bên phải.
3. Dùng thanh công cụ **Cell Editor** để vẽ Tường (Blocked), Đích đến (Terminal), và Nơi bắt đầu (Start). **Lưu ý: Các thuật toán Model-Free bắt buộc phải có ô Start**.
4. Thiết lập tham số toán học ở mục **Parameters**: $\gamma$, $\alpha$, $\epsilon$, Tỉ lệ trượt (Stochastic).
5. Cuộn qua các Tab ở bên trái (Dynamic Programming, TD Learning, Eligibility Traces, Policy Gradients) và chọn thuật toán muốn mô phỏng.
6. Nhấn **Chạy Thuật Toán**. Bạn có thể quan sát quá trình học thông qua:
   - Các chỉ số Value / Policy liên tục thay đổi trên Lưới.
   - Bảng Q-Table Matrix chi tiết.
   - **Biểu đồ Learning Curve (Bên phải)** tăng dần theo thời gian khi Agent ngày càng tìm được đường tối ưu.
   - Chuyển sang bảng **Agent Simulation** nhấn Play để theo dõi Agent tự hành động.
