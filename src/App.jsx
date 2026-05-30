import { useState, useRef, useEffect, useCallback } from "react";
import "./App.css";

function App() {
  const [serials, setSerials] = useState([]);
  const [standardLength, setStandardLength] = useState(null);
  const [standardPattern, setStandardPattern] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [toast, setToast] = useState(null);
  const [flash, setFlash] = useState(null);
  const [activeTab, setActiveTab] = useState("scan");
  const [genStart, setGenStart] = useState("");
  const [genCount, setGenCount] = useState("10");

  const inputRef = useRef(null);
  const flashTimeoutRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // Play a ringing sound for errors
  const playErrorSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      const playTone = (startTime, freq, duration) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(freq, startTime);

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioCtx.currentTime;
      // Fast ringing tone pattern
      for (let i = 0; i < 8; i++) {
        playTone(now + i * 0.08, 880, 0.05);
      }
    } catch (e) {
      console.log("Audio not supported or blocked", e);
    }
  }, []);

  // Keep focus on input
  useEffect(() => {
    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    // Auto focus initially and when clicking anywhere outside
    focusInput();
    window.addEventListener("click", focusInput);

    return () => {
      window.removeEventListener("click", focusInput);
    };
  }, []);

  const showToast = (message, type) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type, id: Date.now() });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  };

  const triggerFlash = (type) => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    setFlash(type);
    flashTimeoutRef.current = setTimeout(() => setFlash(null), 500);
  };
  //test commit
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = inputValue.trim();

      if (!value) return;

      // Logic kiểm tra
      if (standardLength === null) {
        // Lấy mã đầu tiên làm chuẩn (độ dài + pattern chữ/số)
        const pattern = value
          .split("")
          .map((ch) =>
            /\d/.test(ch)
              ? "\\d"
              : /[A-Za-z]/.test(ch)
                ? "[A-Za-z]"
                : ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          )
          .join("");
        setStandardLength(value.length);
        setStandardPattern(new RegExp(`^${pattern}$`));
        addSerial(value);
      } else {
        // Kiểm tra lỗi
        if (serials.includes(value)) {
          handleError(`TRÙNG LẶP: Mã ${value} đã được quét!`);
        } else if (value.length !== standardLength) {
          handleError(
            `SAI ĐỊNH DẠNG: Yêu cầu ${standardLength} ký tự (Mã quét: ${value.length})`,
          );
        } else if (standardPattern && !standardPattern.test(value)) {
          handleError(
            `SAI ĐỊNH DẠNG: Mã không đúng loại (chữ/số không khớp chuẩn)`,
          );
        } else {
          addSerial(value);
        }
      }
    }
  };

  const addSerial = (value) => {
    setSerials((prev) => [value, ...prev]);
    setInputValue("");
    triggerFlash("success");
  };

  const handleError = (message) => {
    playErrorSound();
    triggerFlash("error");
    showToast(message, "error");

    // Keep the input value so user sees what they scanned wrong, but select it so next scan overwrites
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.select();
      }
    }, 10);
  };

  const handleCopy = () => {
    if (serials.length === 0) return;
    // Reverse because we display newest first, but usually want to paste in scan order (oldest first)
    // Actually, usually users want exactly the list they see or chronological. Let's do chronological (oldest first).
    const textToCopy = [...serials].reverse().join("\n");
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        showToast("Đã copy toàn bộ mã vào Clipboard!", "success");
      })
      .catch((err) => {
        showToast("Lỗi khi copy!", "error");
        console.error(err);
      });
  };

  const handleReset = () => {
    if (
      window.confirm(
        "Bạn có chắc muốn xóa toàn bộ danh sách và làm lại từ đầu?",
      )
    ) {
      setSerials([]);
      setStandardLength(null);
      setStandardPattern(null);
      setInputValue("");
      setToast(null);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const handleGenerate = () => {
    if (!genStart) {
      showToast("Vui lòng nhập mã bắt đầu", "error");
      return;
    }
    const count = parseInt(genCount, 10);
    if (isNaN(count) || count < 1 || count > 5000) {
      showToast("Số lượng không hợp lệ (1-5000)", "error");
      return;
    }

    const match = genStart.match(/^(.*?)(\d+)$/);
    if (!match) {
      showToast("Mã bắt đầu phải kết thúc bằng số (VD: SN-001)", "error");
      return;
    }

    const prefix = match[1];
    const numberStr = match[2];
    const paddingLength = numberStr.length;
    let startNum = parseInt(numberStr, 10);

    const newSerials = [];
    for (let i = 0; i < count; i++) {
      const currentNumStr = (startNum + i)
        .toString()
        .padStart(paddingLength, "0");
      const newSerial = `${prefix}${currentNumStr}`;

      if (!serials.includes(newSerial)) {
        newSerials.push(newSerial);
      }
    }

    if (newSerials.length === 0) {
      showToast("Tất cả mã được tạo đã tồn tại", "error");
      return;
    }

    if (standardLength === null) {
      setStandardLength(newSerials[0].length);
    } else {
      const validSerials = newSerials.filter(
        (s) => s.length === standardLength,
      );
      if (validSerials.length !== newSerials.length) {
        showToast(
          `Bỏ qua ${newSerials.length - validSerials.length} mã sai độ dài chuẩn (${standardLength})`,
          "error",
        );
      }
      newSerials.length = 0;
      newSerials.push(...validSerials);
    }

    if (newSerials.length > 0) {
      setSerials((prev) => [...newSerials.reverse(), ...prev]);
      showToast(`Đã tạo ${newSerials.length} mã`, "success");
      triggerFlash("success");
      setGenStart("");
    }
  };

  return (
    <div className={`app-container ${flash ? `flash-${flash}` : ""}`}>
      <div className="header">
        <h1 className="title">Scanner Pro</h1>
        <p className="subtitle">Công cụ hỗ trợ quét và kiểm tra mã vạch</p>
      </div>

      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === "scan" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("scan");
            setTimeout(() => inputRef.current?.focus(), 10);
          }}
        >
          Quét mã thủ công
        </button>
        <button
          className={`tab-btn ${activeTab === "generate" ? "active" : ""}`}
          onClick={() => setActiveTab("generate")}
        >
          Tạo mã tự động
        </button>
      </div>

      <div className="status-panel">
        <div className="status-item">
          <div className="status-label">Đã quét / Đã tạo</div>
          <div className="status-value count">{serials.length}</div>
        </div>
        <div className="status-item">
          <div className="status-label">Độ dài chuẩn</div>
          <div className="status-value standard">
            {standardLength !== null ? standardLength : "--"}
          </div>
        </div>
      </div>

      {activeTab === "scan" ? (
        <div className="scanner-input-container">
          <input
            ref={inputRef}
            type="text"
            className="scanner-input"
            placeholder="Quét mã vạch vào đây..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck="false"
          />
        </div>
      ) : (
        <div className="generator-container">
          <div className="generator-inputs">
            <div className="input-group">
              <label>Mã bắt đầu (VD: SN-001)</label>
              <input
                type="text"
                value={genStart}
                onChange={(e) => setGenStart(e.target.value)}
                className="gen-input"
                placeholder="VD: SN-001"
              />
            </div>
            <div className="input-group">
              <label>Số lượng</label>
              <input
                type="number"
                min="1"
                max="5000"
                value={genCount}
                onChange={(e) => setGenCount(e.target.value)}
                className="gen-input"
              />
            </div>
          </div>
          <button
            className="btn btn-primary generate-btn"
            onClick={handleGenerate}
          >
            Tạo mã ngay
          </button>
        </div>
      )}

      <div className="actions">
        <button
          className="btn btn-primary"
          onClick={handleCopy}
          disabled={serials.length === 0}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy tất cả
        </button>
        <button
          className="btn btn-danger"
          onClick={handleReset}
          disabled={serials.length === 0 && standardLength === null}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Làm mới
        </button>
      </div>

      <div className="list-container">
        <div className="list-header">
          <span>Danh sách mã (mới nhất ở trên)</span>
          <span>{serials.length} mã</span>
        </div>
        <ul className="serial-list">
          {serials.map((serial, index) => (
            <li key={`${serial}-${index}`} className="serial-item">
              <span className="serial-number">{serial}</span>
              <span className="serial-index">#{serials.length - index}</span>
            </li>
          ))}
          {serials.length === 0 && (
            <li
              className="serial-item"
              style={{
                justifyContent: "center",
                color: "var(--text-secondary)",
              }}
            >
              Chưa có mã nào được quét
            </li>
          )}
        </ul>
      </div>

      {toast && (
        <div key={toast.id} className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;
