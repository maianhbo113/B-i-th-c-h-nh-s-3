import React, { useCallback, useEffect, useState } from "react";
import Web3 from "web3";
import DominionDAOArtifact from "./DominionDAO.json";
import "./App.css";

// ======================================================
// CẤU HÌNH
// ======================================================

const CONTRACT_ADDRESS = "0xa590649020fA3564D482732ECa469374C122261B";
const SEPOLIA_CHAIN_ID = "0xaa36a7";
const MIN_CONTRIBUTION = 0.01;
const VOTING_DURATION = 5 * 60;

// ======================================================
// COMPONENT APP
// ======================================================

function App() {
  // ----------------------------------------------------
  // TRẠNG THÁI VÍ
  // ----------------------------------------------------

  const [account, setAccount] = useState("");
  const [connected, setConnected] = useState(false);
  const [network, setNetwork] = useState("Chưa kết nối");
  const [connecting, setConnecting] = useState(false);

  const [walletBalance, setWalletBalance] = useState("0");
  const [daoBalance, setDaoBalance] = useState("0");
  const [contributedBalance, setContributedBalance] = useState("0");
  const [isStakeholder, setIsStakeholder] = useState(false);

  // ----------------------------------------------------
  // TRẠNG THÁI FORM
  // ----------------------------------------------------

  const [contribution, setContribution] = useState("0.01");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [proposalAmount, setProposalAmount] = useState("0.001");

  // ----------------------------------------------------
  // TRẠNG THÁI PROPOSAL
  // ----------------------------------------------------

  const [proposals, setProposals] = useState([]);
  const [filter, setFilter] = useState("ALL");

  // ----------------------------------------------------
  // TRẠNG THÁI GIAO DIỆN
  // ----------------------------------------------------

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [darkMode, setDarkMode] = useState(false);

  const [now, setNow] = useState(
    Math.floor(Date.now() / 1000)
  );

  // ----------------------------------------------------
  // THÔNG BÁO
  // ----------------------------------------------------

  const showMessage = (text, type = "info") => {
    setMessage(text);
    setMessageType(type);
  };

  // ----------------------------------------------------
  // WEB3
  // ----------------------------------------------------

  const getWeb3 = useCallback(() => {
    if (!window.ethereum) {
      throw new Error(
        "Không tìm thấy MetaMask. Hãy cài đặt MetaMask trên trình duyệt."
      );
    }

    return new Web3(window.ethereum);
  }, []);

  // ----------------------------------------------------
  // SMART CONTRACT
  // ----------------------------------------------------

  const getDAO = useCallback(
    (web3) => {
      if (!DominionDAOArtifact.abi) {
        throw new Error(
          "Không tìm thấy ABI trong DominionDAO.json."
        );
      }

      return new web3.eth.Contract(
        DominionDAOArtifact.abi,
        CONTRACT_ADDRESS
      );
    },
    []
  );

  // ----------------------------------------------------
  // KIỂM TRA MẠNG SEPOLIA
  // ----------------------------------------------------

  const ensureSepolia = async () => {
    if (!window.ethereum) {
      throw new Error("Bạn chưa cài đặt MetaMask.");
    }

    const chainId = await window.ethereum.request({
      method: "eth_chainId",
    });

    if (chainId !== SEPOLIA_CHAIN_ID) {
      throw new Error(
        "Bạn đang ở sai mạng. Hãy chuyển MetaMask sang Sepolia."
      );
    }
  };

  // ----------------------------------------------------
  // ĐỊNH DẠNG ĐỊA CHỈ
  // ----------------------------------------------------

  const formatAddress = (address) => {
    if (!address) {
      return "Chưa kết nối";
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // ----------------------------------------------------
  // ĐỊNH DẠNG ETH
  // ----------------------------------------------------

  const formatETH = (wei) => {
    try {
      const web3 = new Web3();

      return Number(
        web3.utils.fromWei(String(wei || "0"), "ether")
      ).toLocaleString("vi-VN", {
        maximumFractionDigits: 6,
      });
    } catch (error) {
      console.error("Lỗi định dạng ETH:", error);
      return "0";
    }
  };

  // ----------------------------------------------------
  // ĐỌC FIELD TỪ PROPOSAL
  // ----------------------------------------------------

  const getField = (item, index, name) => {
    if (item && item[name] !== undefined) {
      return item[name];
    }

    return item ? item[index] : undefined;
  };

  // ----------------------------------------------------
  // LẤY DANH SÁCH PROPOSAL
  // ----------------------------------------------------

  const refreshProposals = useCallback(async () => {
    const web3 = getWeb3();
    const dao = getDAO(web3);

    const result = await dao.methods
      .getProposals()
      .call();

    const list = Array.from(result || []).map(
      (item, index) => {
        return {
          id: Number(
            getField(item, 0, "id") ?? index
          ),

          amount: String(
            getField(item, 1, "amount") ?? "0"
          ),

          duration: Number(
            getField(item, 2, "duration") ?? 0
          ),

          upvotes: Number(
            getField(item, 3, "upvotes") ?? 0
          ),

          downvotes: Number(
            getField(item, 4, "downvotes") ?? 0
          ),

          title: String(
            getField(item, 5, "title") ||
              `Proposal #${index}`
          ),

          description: String(
            getField(item, 6, "description") || ""
          ),

          passed: Boolean(
            getField(item, 7, "passed")
          ),

          paid: Boolean(
            getField(item, 8, "paid")
          ),

          beneficiary: String(
            getField(item, 9, "beneficiary") || ""
          ),

          proposer: String(
            getField(item, 10, "proposer") || ""
          ),

          executor: String(
            getField(item, 11, "executor") || ""
          ),
        };
      }
    );

    setProposals(list);
  }, [getDAO, getWeb3]);

  // ----------------------------------------------------
  // CẬP NHẬT SỐ DƯ VÀ THÔNG TIN
  // ----------------------------------------------------

  const refreshAll = useCallback(async () => {
    if (!window.ethereum) {
      setConnected(false);
      setAccount("");
      setNetwork("Chưa cài MetaMask");
      setWalletBalance("0");
      setContributedBalance("0");
      setIsStakeholder(false);
      return;
    }

    try {
      const web3 = getWeb3();

      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });

      const chainId = await window.ethereum.request({
        method: "eth_chainId",
      });

      // Đọc số dư thật của hợp đồng DAO.
      try {
        const daoWei = await web3.eth.getBalance(
          CONTRACT_ADDRESS
        );

        setDaoBalance(
          web3.utils.fromWei(
            daoWei.toString(),
            "ether"
          )
        );
      } catch (error) {
        console.error(
          "Không đọc được số dư DAO:",
          error
        );
      }

      // Không có tài khoản được cấp quyền cho website.
      if (!accounts || accounts.length === 0) {
        setAccount("");
        setConnected(false);

        setNetwork(
          chainId === SEPOLIA_CHAIN_ID
            ? "Sepolia · Chưa kết nối ví"
            : "Chưa kết nối ví"
        );

        setWalletBalance("0");
        setContributedBalance("0");
        setIsStakeholder(false);

        // Proposal có thể được đọc công khai trên Sepolia.
        if (chainId === SEPOLIA_CHAIN_ID) {
          try {
            await refreshProposals();
          } catch (error) {
            console.warn(
              "Chưa đọc được danh sách proposal:",
              error
            );
          }
        }

        return;
      }

      const current = accounts[0];

      setAccount(current);
      setConnected(true);

      // Đang ở sai mạng.
      if (chainId !== SEPOLIA_CHAIN_ID) {
        setNetwork("Sai mạng");
        setIsStakeholder(false);
        setContributedBalance("0");

        const balance = await web3.eth.getBalance(
          current
        );

        setWalletBalance(
          web3.utils.fromWei(
            balance.toString(),
            "ether"
          )
        );

        return;
      }

      setNetwork("Sepolia");

      // Số dư ví.
      const walletWei = await web3.eth.getBalance(
        current
      );

      setWalletBalance(
        web3.utils.fromWei(
          walletWei.toString(),
          "ether"
        )
      );

      const dao = getDAO(web3);

      // Kiểm tra stakeholder.
      let stakeholder = false;

      try {
        stakeholder = Boolean(
          await dao.methods
            .isStakeholder()
            .call({ from: current })
        );
      } catch (error) {
        console.warn(
          "Không kiểm tra được stakeholder:",
          error
        );
      }

      setIsStakeholder(stakeholder);

      // Lấy số ETH đã đóng góp.
      let contributed = "0";

      try {
        const raw = await dao.methods
          .getStakeholderBalance()
          .call({ from: current });

        contributed = web3.utils.fromWei(
          String(raw),
          "ether"
        );
      } catch (error) {
        try {
          const raw = await dao.methods
            .getContributorBalance()
            .call({ from: current });

          contributed = web3.utils.fromWei(
            String(raw),
            "ether"
          );
        } catch (secondError) {
          console.warn(
            "Không đọc được số ETH đã đóng góp:",
            secondError
          );
        }
      }

      setContributedBalance(contributed);

      // Cập nhật proposal.
      try {
        await refreshProposals();
      } catch (error) {
        console.error(
          "Không tải được proposal:",
          error
        );
      }
    } catch (error) {
      console.error("refreshAll:", error);

      showMessage(
        "Không thể cập nhật dữ liệu: " +
          (error.message || "Lỗi không xác định"),
        "error"
      );
    }
  }, [getDAO, getWeb3, refreshProposals]);

  // ----------------------------------------------------
  // KẾT NỐI META MASK
  // ----------------------------------------------------

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        showMessage(
          "Không tìm thấy MetaMask. Hãy cài tiện ích MetaMask rồi tải lại trang.",
          "error"
        );

        return;
      }

      setConnecting(true);
      setLoading(true);
      setMessage("");

      // Mở MetaMask và yêu cầu người dùng chọn tài khoản.
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        setConnected(false);
        setAccount("");

        showMessage(
          "Bạn chưa chọn tài khoản MetaMask.",
          "error"
        );

        return;
      }

      setAccount(accounts[0]);
      setConnected(true);

      const chainId = await window.ethereum.request({
        method: "eth_chainId",
      });

      if (chainId !== SEPOLIA_CHAIN_ID) {
        showMessage(
          "Đã kết nối ví. Đang yêu cầu chuyển sang mạng Sepolia.",
          "info"
        );

        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID,
              },
            ],
          });
        } catch (switchError) {
          console.error(
            "Không chuyển được mạng:",
            switchError
          );

          showMessage(
            "Ví đã kết nối nhưng chưa chuyển sang Sepolia. Hãy chọn Sepolia trong MetaMask.",
            "error"
          );

          await refreshAll();
          return;
        }
      }

      await refreshAll();

      showMessage(
        "Kết nối MetaMask thành công!",
        "success"
      );
    } catch (error) {
      console.error(
        "Lỗi kết nối MetaMask:",
        error
      );

      if (error.code === 4001) {
        showMessage(
          "Bạn đã từ chối yêu cầu kết nối ví.",
          "error"
        );
      } else {
        showMessage(
          "Kết nối thất bại: " +
            (error.message || "Lỗi không xác định"),
          "error"
        );
      }
    } finally {
      setConnecting(false);
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // NGẮT KẾT NỐI Ở GIAO DIỆN
  // ----------------------------------------------------

  const disconnectWallet = () => {
    // MetaMask không cho website tự thu hồi quyền kết nối.
    // Nút này chỉ xóa trạng thái ví ở giao diện ứng dụng.
    setAccount("");
    setConnected(false);
    setWalletBalance("0");
    setContributedBalance("0");
    setIsStakeholder(false);

    showMessage(
      "Đã ẩn tài khoản khỏi giao diện. Muốn thu hồi quyền truy cập, hãy quản lý kết nối trong MetaMask.",
      "info"
    );
  };

  // ----------------------------------------------------
  // CHUYỂN SANG SEPOLIA
  // ----------------------------------------------------

  const switchToSepolia = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("Bạn chưa cài đặt MetaMask.");
      }

      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [
          {
            chainId: SEPOLIA_CHAIN_ID,
          },
        ],
      });

      await refreshAll();

      showMessage(
        "Đã chuyển sang mạng Sepolia.",
        "success"
      );
    } catch (error) {
      console.error(error);

      showMessage(
        "Không chuyển được mạng: " +
          (error.message || "Lỗi không xác định"),
        "error"
      );
    }
  };

  // ----------------------------------------------------
  // ĐÓNG GÓP ETH
  // ----------------------------------------------------

  const contribute = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);

      if (!connected || !account) {
        throw new Error(
          "Hãy kết nối MetaMask trước khi đóng góp."
        );
      }

      await ensureSepolia();

      const amount = Number(
        String(contribution).replace(",", ".")
      );

      if (
        !Number.isFinite(amount) ||
        amount < MIN_CONTRIBUTION
      ) {
        throw new Error(
          "Số ETH đóng góp tối thiểu là 0.01 ETH."
        );
      }

      const web3 = getWeb3();
      const dao = getDAO(web3);

      await dao.methods.contribute().send({
        from: account,
        value: web3.utils.toWei(
          String(amount),
          "ether"
        ),
      });

      showMessage(
        "Đóng góp ETH thành công!",
        "success"
      );

      await refreshAll();
    } catch (error) {
      console.error("Lỗi contribute:", error);

      showMessage(
        "Đóng góp thất bại: " +
          (error.message || "Giao dịch bị hủy"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // TẠO PROPOSAL
  // ----------------------------------------------------

  const createProposal = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);

      if (!connected || !account) {
        throw new Error(
          "Hãy kết nối MetaMask trước."
        );
      }

      await ensureSepolia();

      if (!isStakeholder) {
        throw new Error(
          "Bạn cần đóng góp tối thiểu 0.01 ETH để trở thành stakeholder."
        );
      }

      if (!title.trim()) {
        throw new Error(
          "Vui lòng nhập tiêu đề proposal."
        );
      }

      if (!Web3.utils.isAddress(beneficiary.trim())) {
        throw new Error(
          "Địa chỉ ví người thụ hưởng không hợp lệ."
        );
      }

      const amount = Number(
        String(proposalAmount).replace(",", ".")
      );

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(
          "Số ETH đề xuất phải lớn hơn 0."
        );
      }

      if (amount > Number(daoBalance)) {
        throw new Error(
          "Số ETH đề xuất lớn hơn số dư DAO hiện tại."
        );
      }

      const web3 = getWeb3();
      const dao = getDAO(web3);

      await dao.methods
        .createProposal(
          title.trim(),
          description.trim(),
          beneficiary.trim(),
          web3.utils.toWei(
            String(amount),
            "ether"
          )
        )
        .send({
          from: account,
        });

      setTitle("");
      setDescription("");
      setBeneficiary("");
      setProposalAmount("0.001");

      showMessage(
        "Tạo proposal thành công!",
        "success"
      );

      await refreshAll();
    } catch (error) {
      console.error("Lỗi createProposal:", error);

      showMessage(
        "Tạo proposal thất bại: " +
          (error.message || "Giao dịch bị hủy"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // BỎ PHIẾU
  // ----------------------------------------------------

  const voteProposal = async (proposalId, choice) => {
    try {
      setLoading(true);

      if (!connected || !account) {
        throw new Error(
          "Hãy kết nối MetaMask trước."
        );
      }

      await ensureSepolia();

      if (!isStakeholder) {
        throw new Error(
          "Chỉ stakeholder mới được bỏ phiếu."
        );
      }

      const proposal = proposals.find(
        (item) => item.id === proposalId
      );

      if (!proposal) {
        throw new Error(
          "Không tìm thấy proposal. Hãy làm mới danh sách."
        );
      }

      if (proposal.paid) {
        throw new Error(
          "Proposal này đã được thanh toán."
        );
      }

      if (
        proposal.duration <=
        Math.floor(Date.now() / 1000)
      ) {
        throw new Error(
          "Đã hết thời gian biểu quyết của proposal này."
        );
      }

      const web3 = getWeb3();
      const dao = getDAO(web3);

      await dao.methods
        .performVote(proposalId, choice)
        .send({
          from: account,
        });

      showMessage(
        `Bỏ phiếu ${
          choice ? "TÁN THÀNH" : "PHẢN ĐỐI"
        } thành công!`,
        "success"
      );

      await refreshAll();
    } catch (error) {
      console.error("Lỗi vote:", error);

      showMessage(
        "Bỏ phiếu thất bại: " +
          (error.message || "Giao dịch bị hủy"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // THANH TOÁN CHO NGƯỜI THỤ HƯỞNG
  // ----------------------------------------------------

  const payBeneficiary = async (proposalId) => {
    try {
      setLoading(true);

      if (!connected || !account) {
        throw new Error(
          "Hãy kết nối MetaMask trước."
        );
      }

      await ensureSepolia();

      if (!isStakeholder) {
        throw new Error(
          "Chỉ stakeholder mới được thực hiện thanh toán."
        );
      }

      const proposal = proposals.find(
        (item) => item.id === proposalId
      );

      if (!proposal) {
        throw new Error(
          "Không tìm thấy proposal."
        );
      }

      if (proposal.paid) {
        throw new Error(
          "Proposal này đã được thanh toán."
        );
      }

      if (
        proposal.duration >
        Math.floor(Date.now() / 1000)
      ) {
        throw new Error(
          "Chưa hết thời gian biểu quyết 5 phút."
        );
      }

      if (proposal.upvotes <= proposal.downvotes) {
        throw new Error(
          "Không thể thanh toán: số phiếu thuận phải lớn hơn số phiếu chống."
        );
      }

      if (
        Number(formatETH(proposal.amount)) >
        Number(daoBalance)
      ) {
        throw new Error(
          "Số dư DAO không đủ để thanh toán proposal."
        );
      }

      const web3 = getWeb3();
      const dao = getDAO(web3);

      await dao.methods
        .payBeneficiary(proposalId)
        .send({
          from: account,
        });

      showMessage(
        "Thanh toán thành công! Hãy kiểm tra số dư ví người nhận trên Sepolia.",
        "success"
      );

      await refreshAll();
    } catch (error) {
      console.error("Lỗi thanh toán:", error);

      showMessage(
        "Thanh toán thất bại: " +
          (error.message || "Giao dịch bị hủy"),
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // TRẠNG THÁI PROPOSAL
  // ----------------------------------------------------

  const getStatus = (proposal) => {
    if (proposal.paid) {
      return "PAID";
    }

    if (proposal.duration <= now) {
      return "CLOSED";
    }

    return "OPEN";
  };

  // ----------------------------------------------------
  // ĐẾM NGƯỢC THỜI GIAN
  // ----------------------------------------------------

  const timeRemaining = (duration) => {
    const seconds = Math.max(
      0,
      duration - now
    );

    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;

    return `${minutes} phút ${remainder} giây`;
  };

  // ----------------------------------------------------
  // LỌC PROPOSAL
  // ----------------------------------------------------

  const filteredProposals = proposals.filter(
    (proposal) => {
      if (filter === "ALL") {
        return true;
      }

      return getStatus(proposal) === filter;
    }
  );

  // ----------------------------------------------------
  // TỰ ĐỘNG CẬP NHẬT KHI TÀI KHOẢN/MẠNG THAY ĐỔI
  // ----------------------------------------------------

  useEffect(() => {
    refreshAll();

    if (!window.ethereum) {
      return undefined;
    }

    const onAccountsChanged = (accounts) => {
      if (!accounts || accounts.length === 0) {
        setAccount("");
        setConnected(false);
        setWalletBalance("0");
        setContributedBalance("0");
        setIsStakeholder(false);

        showMessage(
          "Ví đã ngắt kết nối khỏi ứng dụng.",
          "info"
        );
      } else {
        setAccount(accounts[0]);
        setConnected(true);
      }

      refreshAll();
    };

    const onChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on(
      "accountsChanged",
      onAccountsChanged
    );

    window.ethereum.on(
      "chainChanged",
      onChainChanged
    );

    return () => {
      window.ethereum.removeListener?.(
        "accountsChanged",
        onAccountsChanged
      );

      window.ethereum.removeListener?.(
        "chainChanged",
        onChainChanged
      );
    };
  }, [refreshAll]);

  // ----------------------------------------------------
  // CẬP NHẬT ĐỒNG HỒ
  // ----------------------------------------------------

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  // ----------------------------------------------------
  // GIAO DIỆN
  // ----------------------------------------------------

  return (
    <div
      className={`app-shell ${
        darkMode ? "dark-mode" : ""
      }`}
    >
      {/* ================= HEADER ================= */}

      <header className="topbar">
        <div className="brand">
          <div className="brand-logo">
            PTIT
          </div>

          <div>
            <h1>PTIT Dominion</h1>
          </div>
        </div>

        <div className="top-actions">
          <span
            className={`network-pill ${
              network === "Sepolia" ? "online" : ""
            }`}
          >
            {network}
          </span>

          <button
            type="button"
            className="theme-button"
            onClick={() =>
              setDarkMode((value) => !value)
            }
            title="Đổi giao diện"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>

          <button
            type="button"
            className="outline-button"
            onClick={switchToSepolia}
            disabled={loading}
          >
            Sepolia
          </button>

          {/* NÚT KẾT NỐI LUÔN HIỂN THỊ RÕ */}

          {!connected ? (
            <button
              type="button"
              className="wallet-button connect-wallet-button"
              onClick={connectWallet}
              disabled={connecting || loading}
            >
              {connecting
                ? "ĐANG KẾT NỐI..."
                : "🦊 KẾT NỐI VÍ"}
            </button>
          ) : (
            <div className="wallet-menu">
              <button
                type="button"
                className="wallet-button"
                onClick={connectWallet}
                title="Nhấn để đổi/chọn tài khoản MetaMask"
              >
                {formatAddress(account)}
              </button>

              <button
                type="button"
                className="wallet-disconnect-button"
                onClick={disconnectWallet}
                title="Ẩn tài khoản khỏi giao diện"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ================= MAIN ================= */}

      <main className="container">
        {/* THÔNG BÁO */}

        {message && (
          <div
            className={`notice ${messageType}`}
            role="status"
          >
            <span>{message}</span>

            <button
              type="button"
              onClick={() => setMessage("")}
              aria-label="Đóng thông báo"
            >
              ×
            </button>
          </div>
        )}

        {/* CHƯA KẾT NỐI VÍ */}

        {!connected && (
          <section className="connect-banner">
            <div>
              <p className="eyebrow">
                META MASK WALLET
              </p>

              <h2>
                Kết nối ví để tham gia Dominion DAO
              </h2>

              <p>
                Kết nối MetaMask để đóng góp ETH,
                tạo đề xuất, biểu quyết và thực hiện
                thanh toán trên mạng Sepolia.
              </p>
            </div>

            <button
              type="button"
              className="primary-button connect-banner-button"
              onClick={connectWallet}
              disabled={connecting || loading}
            >
              {connecting
                ? "ĐANG KẾT NỐI..."
                : "🦊 KẾT NỐI METAMASK"}
            </button>
          </section>
        )}

        {/* SAI MẠNG */}

        {connected && network !== "Sepolia" && (
          <section className="connect-banner">
            <div>
              <h2>Vui lòng chuyển sang Sepolia</h2>

              <p>
                Ví đã kết nối nhưng đang ở sai mạng.
                Hãy chuyển mạng để sử dụng các chức năng DAO.
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={switchToSepolia}
            >
              CHUYỂN SANG SEPOLIA
            </button>
          </section>
        )}

        {/* ================= DASHBOARD ================= */}

        <section className="dashboard">
          <div className="dashboard-heading">
            <div>
              <p className="eyebrow">
                QUẢN TRỊ PHÂN QUYỀN
              </p>

              <h2>
                {proposals.filter(
                  (proposal) =>
                    getStatus(proposal) === "OPEN"
                ).length}{" "}
                đề xuất đang mở
              </h2>

              <p className="dashboard-description">
                Quản lý đóng góp, biểu quyết và thanh toán
                minh bạch trên blockchain.
              </p>
            </div>

            <div className="dashboard-balance">
              <span>Số dư DAO hiện tại</span>

              <strong>
                {Number(daoBalance).toLocaleString(
                  "vi-VN",
                  {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4,
                  }
                )}{" "}
                ETH
              </strong>

              <small>Mạng thử nghiệm Sepolia</small>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span>Ví của bạn</span>

              <strong>
                {Number(walletBalance).toLocaleString(
                  "vi-VN",
                  {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4,
                  }
                )}{" "}
                ETH
              </strong>

              <small>
                {connected
                  ? formatAddress(account)
                  : "Chưa kết nối ví"}
              </small>
            </div>

            <div className="stat-card">
              <span>Đóng góp của bạn</span>

              <strong>
                {Number(
                  contributedBalance
                ).toLocaleString("vi-VN", {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4,
                })}{" "}
                ETH
              </strong>

              <small>
                {isStakeholder
                  ? "Bạn là stakeholder ✓"
                  : "Đóng góp từ 0.01 ETH để thành stakeholder"}
              </small>
            </div>

            <div className="stat-card">
              <span>Tổng đề xuất</span>

              <strong>{proposals.length}</strong>

              <small>
                Được lưu trên smart contract
              </small>
            </div>
          </div>
        </section>

        {/* ================= ĐÓNG GÓP ================= */}

        <section className="contribution-section">
          <div className="section-heading">
            <div>
              <h2>Tham gia Dominion DAO</h2>

              <p>
                Đóng góp ETH để tham gia quản trị
                và quyết định các đề xuất.
              </p>
            </div>
          </div>

          <form
            className="contribution-form"
            onSubmit={contribute}
          >
            <input
              type="number"
              min={MIN_CONTRIBUTION}
              step="0.001"
              value={contribution}
              onChange={(event) =>
                setContribution(event.target.value)
              }
              placeholder="Nhập số ETH muốn đóng góp"
              required
              disabled={loading}
            />

            <button
              className="primary-button"
              type="submit"
              disabled={
                loading ||
                !connected ||
                network !== "Sepolia"
              }
            >
              {loading
                ? "ĐANG XỬ LÝ..."
                : "ĐÓNG GÓP"}
            </button>
          </form>

          <p className="helper-text">
            Yêu cầu tối thiểu để trở thành stakeholder:
            0.01 ETH.
          </p>

          {!connected && (
            <p className="helper-text">
              Hãy kết nối MetaMask trước khi đóng góp.
            </p>
          )}
        </section>

        {/* ================= TẠO PROPOSAL ================= */}

        <section className="create-section">
          <div className="section-heading">
            <div>
              <h2>Tạo đề xuất</h2>

              <p>
                Tạo đề xuất thanh toán ETH cho người thụ hưởng.
              </p>
            </div>

            <span
              className={`role-badge ${
                isStakeholder ? "active" : ""
              }`}
            >
              {isStakeholder
                ? "✓ STAKEHOLDER"
                : "CHƯA LÀ STAKEHOLDER"}
            </span>
          </div>

          <form
            className="proposal-form"
            onSubmit={createProposal}
          >
            <div className="form-row">
              <label>
                Tiêu đề đề xuất

                <input
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  placeholder="Ví dụ: Hỗ trợ dự án"
                  required
                  disabled={loading}
                />
              </label>

              <label>
                Số ETH đề xuất

                <input
                  type="number"
                  min="0.000001"
                  step="0.001"
                  value={proposalAmount}
                  onChange={(event) =>
                    setProposalAmount(event.target.value)
                  }
                  required
                  disabled={loading}
                />
              </label>
            </div>

            <label>
              Địa chỉ ví người thụ hưởng

              <input
                value={beneficiary}
                onChange={(event) =>
                  setBeneficiary(event.target.value)
                }
                placeholder="0x..."
                required
                disabled={loading}
              />
            </label>

            <label>
              Mô tả đề xuất

              <textarea
                rows="3"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Mô tả nội dung đề xuất..."
                disabled={loading}
              />
            </label>

            <button
              type="submit"
              className="primary-button"
              disabled={
                loading ||
                !connected ||
                network !== "Sepolia" ||
                !isStakeholder
              }
            >
              {loading
                ? "ĐANG XỬ LÝ..."
                : "TẠO ĐỀ XUẤT"}
            </button>

            {!isStakeholder && (
              <p className="helper-text">
                Bạn cần đóng góp tối thiểu 0.01 ETH
                để trở thành stakeholder và tạo đề xuất.
              </p>
            )}
          </form>
        </section>

        {/* ================= DANH SÁCH PROPOSAL ================= */}

        <section className="proposals-section">
          <div className="section-heading proposals-heading">
            <div>
              <h2>Danh sách đề xuất</h2>

              <p>
                Theo dõi thời gian biểu quyết,
                kết quả và trạng thái thanh toán.
              </p>
            </div>

            <button
              type="button"
              className="outline-button"
              onClick={refreshAll}
              disabled={loading}
            >
              ↻ LÀM MỚI
            </button>
          </div>

          {/* BỘ LỌC */}

          <div className="filter-bar">
            {[
              ["ALL", "Tất cả"],
              ["OPEN", "Đang mở"],
              ["CLOSED", "Đã đóng"],
              ["PAID", "Đã thanh toán"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={
                  filter === value ? "selected" : ""
                }
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* CHƯA CÓ PROPOSAL */}

          {filteredProposals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">◇</div>

              <h3>Chưa có đề xuất</h3>

              <p>
                Không có đề xuất nào trong mục này.
                Hãy tạo đề xuất mới để bắt đầu.
              </p>
            </div>
          ) : (
            <div className="proposal-list">
              {filteredProposals.map((proposal) => {
                const status = getStatus(proposal);

                const canVote =
                  status === "OPEN" &&
                  connected &&
                  network === "Sepolia" &&
                  isStakeholder;

                const canPay =
                  status === "CLOSED" &&
                  !proposal.paid &&
                  proposal.upvotes > proposal.downvotes &&
                  Number(formatETH(proposal.amount)) <=
                    Number(daoBalance);

                return (
                  <article
                    className="proposal-card"
                    key={proposal.id}
                  >
                    {/* ĐẦU THẺ */}

                    <div className="proposal-card-top">
                      <span
                        className={`status-badge ${status.toLowerCase()}`}
                      >
                        {status === "OPEN"
                          ? "ĐANG MỞ"
                          : status === "CLOSED"
                            ? "ĐÃ ĐÓNG"
                            : "ĐÃ THANH TOÁN"}
                      </span>

                      <span className="proposal-id">
                        PROPOSAL #{proposal.id}
                      </span>
                    </div>

                    {/* NỘI DUNG */}

                    <h3>{proposal.title}</h3>

                    <p className="proposal-description">
                      {proposal.description ||
                        "Không có mô tả."}
                    </p>

                    {/* THÔNG TIN */}

                    <div className="proposal-details">
                      <div>
                        <span>Người tạo</span>

                        <strong
                          title={proposal.proposer}
                        >
                          {formatAddress(
                            proposal.proposer
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Người thụ hưởng</span>

                        <strong
                          title={proposal.beneficiary}
                        >
                          {formatAddress(
                            proposal.beneficiary
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Số tiền</span>

                        <strong>
                          {formatETH(proposal.amount)} ETH
                        </strong>
                      </div>

                      <div>
                        <span>
                          {status === "OPEN"
                            ? "Thời gian còn lại"
                            : "Trạng thái biểu quyết"}
                        </span>

                        <strong>
                          {status === "OPEN"
                            ? timeRemaining(
                                proposal.duration
                              )
                            : status === "PAID"
                              ? "Đã thanh toán"
                              : "Đã hết thời gian"}
                        </strong>
                      </div>
                    </div>

                    {/* KẾT QUẢ BỎ PHIẾU */}

                    <div className="vote-summary">
                      <div className="vote-count">
                        <span className="upvote">
                          ▲ {proposal.upvotes} Thuận
                        </span>

                        <span className="downvote">
                          ▼ {proposal.downvotes} Chống
                        </span>
                      </div>

                      <div className="vote-progress">
                        <div
                          className="vote-progress-yes"
                          style={{
                            width:
                              proposal.upvotes +
                                proposal.downvotes ===
                              0
                                ? "0%"
                                : `${
                                    (proposal.upvotes /
                                      (proposal.upvotes +
                                        proposal.downvotes)) *
                                    100
                                  }%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* CÁC NÚT HÀNH ĐỘNG */}

                    <div className="proposal-actions">
                      {canVote && (
                        <>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={loading}
                            onClick={() =>
                              voteProposal(
                                proposal.id,
                                true
                              )
                            }
                          >
                            ▲ BỎ PHIẾU THUẬN
                          </button>

                          <button
                            type="button"
                            className="outline-button danger-button"
                            disabled={loading}
                            onClick={() =>
                              voteProposal(
                                proposal.id,
                                false
                              )
                            }
                          >
                            ▼ BỎ PHIẾU CHỐNG
                          </button>
                        </>
                      )}

                      {status === "OPEN" &&
                        !isStakeholder && (
                          <p className="helper-text">
                            Bạn cần là stakeholder để bỏ phiếu.
                          </p>
                        )}

                      {status === "OPEN" &&
                        isStakeholder &&
                        !connected && (
                          <p className="helper-text">
                            Hãy kết nối MetaMask để bỏ phiếu.
                          </p>
                        )}

                      {canPay && (
                        <button
                          type="button"
                          className="primary-button"
                          disabled={
                            loading ||
                            !connected ||
                            !isStakeholder
                          }
                          onClick={() =>
                            payBeneficiary(proposal.id)
                          }
                        >
                          THANH TOÁN NGƯỜI THỤ HƯỞNG
                        </button>
                      )}

                      {status === "CLOSED" &&
                        !proposal.paid &&
                        proposal.upvotes <=
                          proposal.downvotes && (
                          <p className="helper-text">
                            Không đủ điều kiện thanh toán:
                            số phiếu thuận phải lớn hơn
                            số phiếu chống.
                          </p>
                        )}

                      {status === "CLOSED" &&
                        !proposal.paid &&
                        proposal.upvotes >
                          proposal.downvotes &&
                        Number(
                          formatETH(proposal.amount)
                        ) > Number(daoBalance) && (
                          <p className="helper-text">
                            DAO không đủ số dư để thanh toán
                            đề xuất này.
                          </p>
                        )}

                      {status === "PAID" && (
                        <span className="paid-message">
                          ✓ Đã thanh toán thành công
                        </span>
                      )}
                    </div>

                    {/* CHÚ THÍCH */}

                    {status === "OPEN" && (
                      <p className="helper-text">
                        Thời gian biểu quyết là 5 phút.
                        Chỉ stakeholder mới được bỏ phiếu.
                        Sau khi hết thời gian, đề xuất chỉ
                        có thể được thanh toán nếu số phiếu
                        thuận lớn hơn số phiếu chống và
                        DAO đủ số dư.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ================= FOOTER ================= */}

        <footer className="footer">
          <strong>PTIT Dominion</strong>

          <span>
            Decentralized Autonomous Organization
          </span>

          <span>
            Powered by Ethereum · Sepolia Testnet
          </span>

          <span>
            Contract: {formatAddress(CONTRACT_ADDRESS)}
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;