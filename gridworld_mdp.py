from typing import List, Tuple, Set, Dict
import math


Coord = Tuple[int, int]

ACTIONS: Dict[str, Coord] = {
    "U": (-1, 0),
    "D": (1, 0),
    "L": (0, -1),
    "R": (0, 1),
}

ARROWS = {
    "U": "↑",
    "D": "↓",
    "L": "←",
    "R": "→",
}


def in_bounds(r: int, c: int, m: int, n: int) -> bool:
    return 0 <= r < m and 0 <= c < n


def next_state(
    state: Coord,
    action: str,
    m: int,
    n: int,
    blocked: Set[Coord],
) -> Coord:
    """
    Deterministic transition:
    - Nếu đi ra ngoài grid hoặc đụng ô bị lấp thì đứng yên.
    - Ngược lại chuyển sang ô mới.
    """
    r, c = state
    dr, dc = ACTIONS[action]
    nr, nc = r + dr, c + dc

    if not in_bounds(nr, nc, m, n):
        return state

    if (nr, nc) in blocked:
        return state

    return (nr, nc)


def reward_function(
    state: Coord,
    action: str,
    next_s: Coord,
    terminals: Dict[Coord, float],
    step_reward: float,
) -> float:
    """
    Reward đơn giản:
    - Đi vào terminal: nhận reward của terminal đó
    - Các bước khác: step_reward
    """
    if next_s in terminals:
        return terminals[next_s]
    return step_reward


def value_iteration(
    m: int,
    n: int,
    blocked: Set[Coord],
    terminals: Dict[Coord, float],
    gamma: float = 0.9,
    theta: float = 1e-4,
    step_reward: float = -0.04,
    max_iterations: int = 10_000,
) -> Tuple[List[List[float]], List[List[str]], int, float]:
    """
    Chạy Value Iteration trên grid m x n.

    Return:
    - V: ma trận value
    - policy: ma trận policy
    - iterations: số vòng lặp đã chạy
    - delta: sai số cuối cùng
    """

    if not (0 <= gamma < 1):
        raise ValueError("gamma phải nằm trong [0, 1).")

    if theta <= 0:
        raise ValueError("theta phải > 0.")

    for terminal in terminals:
        if terminal in blocked:
            raise ValueError(f"Terminal {terminal} không được nằm trong ô bị lấp.")

    # Khởi tạo V(s) = 0 cho mọi ô
    V = [[0.0 for _ in range(n)] for _ in range(m)]

    states = [
        (r, c)
        for r in range(m)
        for c in range(n)
        if (r, c) not in blocked
    ]

    final_delta = math.inf

    for iteration in range(1, max_iterations + 1):
        new_V = [row[:] for row in V]
        delta = 0.0

        for s in states:
            r, c = s

            # Terminal state, value giữ 0
            if s in terminals:
                new_V[r][c] = 0.0
                continue

            best_value = -math.inf

            for action in ACTIONS:
                ns = next_state(s, action, m, n, blocked)
                nr, nc = ns

                reward = reward_function(
                    state=s,
                    action=action,
                    next_s=ns,
                    terminals=terminals,
                    step_reward=step_reward,
                )

                candidate_value = reward + gamma * V[nr][nc]
                best_value = max(best_value, candidate_value)

            new_V[r][c] = best_value
            delta = max(delta, abs(new_V[r][c] - V[r][c]))

        V = new_V
        final_delta = delta

        if delta < theta:
            break

    policy = extract_policy(
        V=V,
        m=m,
        n=n,
        blocked=blocked,
        terminals=terminals,
        gamma=gamma,
        step_reward=step_reward,
    )

    return V, policy, iteration, final_delta


def extract_policy(
    V: List[List[float]],
    m: int,
    n: int,
    blocked: Set[Coord],
    terminals: Dict[Coord, float],
    gamma: float,
    step_reward: float,
) -> List[List[str]]:
    """
    Sau khi có V(s), extract policy bằng greedy:

    pi(s) = argmax_a [R(s,a,s') + gamma * V(s')]
    """

    policy = [["" for _ in range(n)] for _ in range(m)]

    for r in range(m):
        for c in range(n):
            s = (r, c)

            if s in blocked:
                policy[r][c] = "#"
                continue

            if s in terminals:
                policy[r][c] = "T"
                continue

            best_action = None
            best_value = -math.inf

            for action in ACTIONS:
                ns = next_state(s, action, m, n, blocked)
                nr, nc = ns

                reward = reward_function(
                    state=s,
                    action=action,
                    next_s=ns,
                    terminals=terminals,
                    step_reward=step_reward,
                )

                candidate_value = reward + gamma * V[nr][nc]

                if candidate_value > best_value:
                    best_value = candidate_value
                    best_action = action

            policy[r][c] = ARROWS[best_action]

    return policy


def policy_evaluation(
    policy: List[List[str]],
    m: int,
    n: int,
    blocked: Set[Coord],
    terminals: Dict[Coord, float],
    gamma: float,
    theta: float,
    step_reward: float,
    verbose: bool = False,
) -> List[List[float]]:
    V = [[0.0 for _ in range(n)] for _ in range(m)]
    states = [(r, c) for r in range(m) for c in range(n) if (r, c) not in blocked]
    
    sweep = 0
    while True:
        sweep += 1
        delta = 0.0
        new_V = [row[:] for row in V]
        
        for s in states:
            r, c = s
            if s in terminals:
                new_V[r][c] = 0.0
                continue
                
            action = policy[r][c]
            if not action or action in ["#", "T"]:
                continue
                
            ns = next_state(s, action, m, n, blocked)
            nr, nc = ns
            
            reward = reward_function(s, action, ns, terminals, step_reward)
            new_V[r][c] = reward + gamma * V[nr][nc]
            
            delta = max(delta, abs(new_V[r][c] - V[r][c]))
            
        V = new_V
        if delta < theta:
            if verbose:
                print(f"    Policy Evaluation hội tụ sau {sweep} sweep (delta={delta:.8f} < theta={theta})")
            break
            
    return V


def policy_improvement(
    V: List[List[float]],
    policy: List[List[str]],
    m: int,
    n: int,
    blocked: Set[Coord],
    terminals: Dict[Coord, float],
    gamma: float,
    step_reward: float,
    verbose: bool = False,
) -> bool:
    policy_stable = True
    states = [(r, c) for r in range(m) for c in range(n) if (r, c) not in blocked]
    changes = []
    
    for s in states:
        r, c = s
        if s in terminals:
            continue
            
        old_action = policy[r][c]
        
        best_action = None
        best_value = -math.inf
        
        for action in ACTIONS:
            ns = next_state(s, action, m, n, blocked)
            nr, nc = ns
            reward = reward_function(s, action, ns, terminals, step_reward)
            candidate_value = reward + gamma * V[nr][nc]
            
            if candidate_value > best_value:
                best_value = candidate_value
                best_action = action
                
        if old_action != best_action:
            policy_stable = False
            changes.append((s, old_action, best_action))
            
        policy[r][c] = best_action
    
    if verbose:
        if changes:
            print(f"    Policy Improvement: {len(changes)} ô thay đổi action:")
            for coord, old_a, new_a in changes:
                print(f"      State {coord}: {ARROWS.get(old_a, old_a)} → {ARROWS.get(new_a, new_a)}")
        else:
            print("    Policy Improvement: Không có ô nào thay đổi → Policy đã ổn định!")
        
    return policy_stable


def policy_iteration(
    m: int,
    n: int,
    blocked: Set[Coord],
    terminals: Dict[Coord, float],
    gamma: float = 0.9,
    theta: float = 1e-4,
    step_reward: float = -0.04,
    max_iterations: int = 10_000,
    verbose: bool = False,
) -> Tuple[List[List[float]], List[List[str]], int]:
    # Khởi tạo policy (chọn "U" cho tất cả trạng thái không phải terminal/blocked)
    policy = [["U" for _ in range(n)] for _ in range(m)]
    
    for r in range(m):
        for c in range(n):
            if (r, c) in blocked:
                policy[r][c] = "#"
            elif (r, c) in terminals:
                policy[r][c] = "T"

    if verbose:
        print("\n--- Khởi tạo ---")
        print("Policy ban đầu (tất cả state → ↑):")
        for r in range(m):
            row_str = []
            for c in range(n):
                row_str.append(ARROWS.get(policy[r][c], policy[r][c]))
            print("  ".join(row_str))
                
    iterations = 0
    V = [[0.0 for _ in range(n)] for _ in range(m)]
    
    while iterations < max_iterations:
        iterations += 1

        if verbose:
            print(f"\n{'='*50}")
            print(f"  Vòng lặp {iterations}")
            print(f"{'='*50}")
            print(f"  Bước 1: Policy Evaluation")
            print(f"    Tính V(s) cho policy hiện tại (dùng action cố định từ π)...")

        V = policy_evaluation(policy, m, n, blocked, terminals, gamma, theta, step_reward, verbose)

        if verbose:
            print(f"\n    V(s) sau Evaluation:")
            for r, row in enumerate(V):
                line = []
                for c, value in enumerate(row):
                    if (r, c) in blocked:
                        line.append("#####")
                    else:
                        line.append(f"{value:5.2f}")
                print(f"    {' '.join(line)}")

            print(f"\n  Bước 2: Policy Improvement")
            print(f"    Với V(s) mới, tìm action tốt nhất cho mỗi state...")

        stable = policy_improvement(V, policy, m, n, blocked, terminals, gamma, step_reward, verbose)

        if verbose:
            print(f"\n    Policy sau Improvement:")
            for r in range(m):
                row_str = []
                for c in range(n):
                    if (r, c) in blocked:
                        row_str.append("#")
                    elif (r, c) in terminals:
                        row_str.append("T")
                    else:
                        row_str.append(ARROWS.get(policy[r][c], policy[r][c]))
                print(f"    {'  '.join(row_str)}")

        if stable:
            if verbose:
                print(f"\n  → Policy STABLE! Kết thúc sau {iterations} vòng.")
            break
        else:
            if verbose:
                print(f"\n  → Policy chưa ổn định, tiếp tục vòng lặp tiếp theo...")
            
    # Chuyển đổi action sang ký hiệu mũi tên để hiển thị
    display_policy = [["" for _ in range(n)] for _ in range(m)]
    for r in range(m):
        for c in range(n):
            if (r, c) in blocked:
                display_policy[r][c] = "#"
            elif (r, c) in terminals:
                display_policy[r][c] = "T"
            else:
                display_policy[r][c] = ARROWS.get(policy[r][c], policy[r][c])
                
    return V, display_policy, iterations


def print_value_matrix(V: List[List[float]], blocked: Set[Coord]) -> None:
    print("\nValue Matrix V(s):")
    for r, row in enumerate(V):
        line = []
        for c, value in enumerate(row):
            if (r, c) in blocked:
                line.append("#####")
            else:
                line.append(f"{value:5.2f}")
        print(" ".join(line))


def print_policy(policy: List[List[str]]) -> None:
    print("\nPolicy Matrix pi(s):")
    for row in policy:
        print("  ".join(row))


def read_coord(prompt: str) -> Coord:
    raw = input(prompt).strip()
    for char in "()[],":
        raw = raw.replace(char, " ")
    parts = raw.split()
    if len(parts) != 2:
        raise ValueError("Tọa độ phải có 2 số (ví dụ: 1 1 hoặc (1, 1))")
    return int(parts[0]), int(parts[1])


def main() -> None:
    print("=== GridWorld Value Iteration ===")
    print("Quy ước tọa độ: 0-indexed, tức hàng/cột bắt đầu từ 0.")
    print("Ví dụ: ô góc trên trái là (0, 0).\n")

    while True:
        try:
            m = int(input("Nhập số hàng m: "))
            n = int(input("Nhập số cột n: "))
            if m > 0 and n > 0:
                break
            print("m và n phải > 0. Vui lòng nhập lại.")
        except ValueError:
            print("Vui lòng nhập số nguyên hợp lệ.")

    while True:
        try:
            k = int(input("Nhập số ô bị lấp k: "))
            if k >= 0:
                break
            print("k phải >= 0. Vui lòng nhập lại.")
        except ValueError:
            print("Vui lòng nhập số nguyên hợp lệ.")

    blocked: Set[Coord] = set()

    if k > 0:
        print("\nNhập tọa độ các ô bị lấp, dạng: row col")
    for i in range(k):
        while True:
            try:
                coord = read_coord(f"Blocked cell {i + 1}: ")
                if not in_bounds(coord[0], coord[1], m, n):
                    print(f"Tọa độ {coord} nằm ngoài ma trận {m}x{n}. Vui lòng nhập lại.")
                else:
                    blocked.add(coord)
                    break
            except ValueError as e:
                print(e)

    while True:
        try:
            num_terminals = int(input("\nNhập số lượng terminal: "))
            if num_terminals > 0:
                break
            print("Số lượng terminal phải > 0. Vui lòng nhập lại.")
        except ValueError:
            print("Vui lòng nhập số nguyên hợp lệ.")

    terminals: Dict[Coord, float] = {}
    for i in range(num_terminals):
        while True:
            try:
                t_coord = read_coord(f"Terminal {i + 1} (dạng: row col): ")
                if not in_bounds(t_coord[0], t_coord[1], m, n):
                    print(f"Terminal {t_coord} nằm ngoài ma trận {m}x{n}. Vui lòng nhập lại.")
                    continue
                if t_coord in blocked:
                    print("Terminal không được trùng với ô bị lấp. Vui lòng nhập lại.")
                    continue
                
                t_val = float(input(f"Nhập giá trị (reward) cho Terminal {i + 1}: "))
                terminals[t_coord] = t_val
                break
            except ValueError as e:
                print(e)

    while True:
        try:
            g_in = input("Nhập gamma (ví dụ 0.9) [Nhấn Enter để dùng mặc định 0.9]: ").strip()
            if not g_in:
                gamma = 0.9
                break
            gamma = float(g_in)
            if 0 <= gamma < 1:
                break
            print("Gamma phải nằm trong [0, 1). Vui lòng nhập lại.")
        except ValueError:
            print("Vui lòng nhập số hợp lệ.")

    while True:
        try:
            t_in = input("Nhập theta threshold (ví dụ 0.0001) [Nhấn Enter để dùng mặc định 0.0001]: ").strip()
            if not t_in:
                theta = 0.0001
                break
            theta = float(t_in)
            if theta > 0:
                break
            print("Theta phải > 0. Vui lòng nhập lại.")
        except ValueError:
            print("Vui lòng nhập số hợp lệ.")

    while True:
        try:
            r_in = input("Nhập step_reward (cost mỗi bước, ví dụ -0.04) [Nhấn Enter để dùng mặc định -0.04]: ").strip()
            if not r_in:
                step_reward = -0.04
                break
            step_reward = float(r_in)
            break
        except ValueError:
            print("Vui lòng nhập số hợp lệ.")

    while True:
        algo = input("\nChọn thuật toán (1: Value Iteration, 2: Policy Iteration) [Mặc định 1]: ").strip()
        if not algo or algo == "1":
            algo = "1"
            break
        elif algo == "2":
            break
        print("Vui lòng nhập 1 hoặc 2.")

    if algo == "1":
        V, policy, iterations, final_delta = value_iteration(
            m=m,
            n=n,
            blocked=blocked,
            terminals=terminals,
            gamma=gamma,
            theta=theta,
            step_reward=step_reward,
        )
        print("\n=== Value Iteration Result ===")
        print(f"Số vòng lặp (Value updates): {iterations}")
        print(f"Delta cuối: {final_delta:.8f}")
    else:
        V, policy, iterations = policy_iteration(
            m=m,
            n=n,
            blocked=blocked,
            terminals=terminals,
            gamma=gamma,
            theta=theta,
            step_reward=step_reward,
            verbose=True,
        )
        print("\n=== Policy Iteration Result ===")
        print(f"Số lần Policy Evaluation/Improvement: {iterations}")

    print_value_matrix(V, blocked)
    print_policy(policy)


if __name__ == "__main__":
    main()
