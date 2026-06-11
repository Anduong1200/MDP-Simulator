# GridWorld MDP Visualizer

Một phần mềm mô phỏng trực quan các thuật toán cốt lõi của **Reinforcement Learning** (dựa theo sách *Reinforcement Learning: An Introduction* - Sutton & Barto, Chapter 3 & 4), tập trung vào bài toán Markov Decision Process (MDP) hữu hạn.

## Tính năng chính
- **Mô phỏng Môi trường (Environment)**: Tạo Grid tùy chỉnh kích thước, đặt các vật cản (Blocked), Terminal States có thưởng/phạt, và vị trí xuất phát (Start).
- **Môi trường Deterministic & Stochastic**: Cho phép điều chỉnh tỉ lệ trượt (Slip probability) của Agent. Mặc định Agent chọn đi thẳng nhưng có thể cấu hình để có xác suất bị trượt sang hai bên.
- **Dynamic Programming (Model-Based)**: 
  - **Value Iteration & Policy Iteration**: Trực quan hóa từng bước hội tụ (sweep) bằng hiệu ứng Animation thời gian thực. Hỗ trợ đầy đủ **Asynchronous Dynamic Programming** (Gauss-Seidel in-place updates) giúp tăng tốc độ hội tụ.
  - **Generalized Policy Iteration (GPI)**: Thay đổi số lượng vòng lặp Policy Evaluation ($k$) tối đa để mô phỏng sự dịch chuyển mượt mà giữa Value Iteration và Policy Iteration.
  - **Đánh giá Policy (Policy Evaluation)**: Vẽ tay một Policy bất kỳ và giải phương trình Bellman Expectation để tìm Value function $V_\pi(s)$.
- **Temporal-Difference Learning (Model-Free)**: Mô phỏng quá trình Agent tự học thông qua tương tác trực tiếp với môi trường (Trial and Error). Hỗ trợ đầy đủ các thuật toán cốt lõi của Chapter 6:
  - **Q-Learning** (Off-policy TD Control)
  - **SARSA** (On-policy TD Control)
  - **Expected SARSA**
  - **Double Q-Learning** (Khắc phục Maximization Bias)
- **Tính toán Q-Value $Q(s,a)$**: Xem chi tiết giá trị Action-Value cho từng hành động tại mỗi trạng thái bằng cách hover chuột lên Grid hoặc mở bảng **Q-Table Matrix** (Live update trong quá trình TD Learning).
- **Mô phỏng Agent & Discounted Return ($G_t$)**: Thả Agent vào lưới và xem Agent di chuyển thực tế theo Policy, đồng thời hệ thống tự động tính toán tổng phần thưởng chiết khấu $G_t$.

## Công nghệ sử dụng
- **HTML5, CSS3, JavaScript (Vanilla)**: Hoàn toàn không cần cài đặt Node.js hay bất kỳ Framework nào.
- **MathJax**: Tích hợp để hiển thị các công thức toán học (Bellman Equation, Return, Transition Probabilities) chuẩn LaTeX ngay trên giao diện.

## Cách sử dụng
1. Mở trực tiếp file `index.html` bằng trình duyệt web của bạn (Chrome, Edge, Firefox...).
2. Thiết lập thông số Grid (Rows/Cols) và nhấn **Tạo Grid**.
3. Dùng thanh công cụ **Cell Editor** để vẽ Tường (Blocked), Đích đến (Terminal), và Nơi bắt đầu (Start).
4. Thiết lập tham số toán học ở mục **Parameters**: $\gamma$, $\theta$, Step Reward và Tỉ lệ trượt (Stochastic).
5. Chọn thuật toán (Value Iteration, Policy Iteration hoặc Evaluate Policy) và nhấn **Chạy Thuật Toán**.
6. Xem các giá trị thay đổi trên lưới. Hover chuột để xem $Q(s,a)$. Chuyển sang bảng **Agent Simulation** nhấn Play để chạy mô phỏng Episode.
