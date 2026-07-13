"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const router = useRouter();

  async function login() {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pin,
      }),
    });

    if (res.ok) {
      sessionStorage.setItem("admin-auth", "true");
      router.push("/admin/dashboard");
    } else {
      setError("Invalid PIN");
      setPin("");
    }
  }

  return (
    <main className="admin-login">
      <div className="login-card">

        <div className="brand">
          Brain Forge <span>AI DevOp</span>
        </div>

        <div className="brand-sub">
          ADMIN ACCESS PANEL
        </div>

        <div className="divider" />

        <h1>Enter PIN</h1>

        <p>
          Authorized personnel only
        </p>

        <input
          type="password"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••••"
          onKeyDown={(e) => {
            if (e.key === "Enter") login();
          }}
        />

        <button onClick={login}>
          Unlock Console
        </button>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

      </div>


      <style jsx>{`
        .admin-login {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          background: #161209;
          color: #f3ecdc;
          font-family: Inter, sans-serif;
        }

        .login-card {
          width: 360px;
          background: #201a11;
          border: 1px solid #3e3220;
          border-radius: 12px;
          padding: 35px;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0,0,0,.4);
        }

        .brand {
          font-family: "Space Grotesk", sans-serif;
          font-size: 22px;
          font-weight: 700;
        }

        .brand span {
          color: #e8862e;
        }

        .brand-sub {
          margin-top: 8px;
          font-family: "IBM Plex Mono", monospace;
          font-size: 11px;
          color: #7a6f5b;
          letter-spacing: 1px;
        }

        .divider {
          height: 1px;
          background: #3e3220;
          margin: 25px 0;
        }

        h1 {
          font-size: 20px;
          margin-bottom: 6px;
        }

        p {
          color: #b0a28a;
          font-size: 13px;
          margin-bottom: 20px;
        }

        input {
          width: 100%;
          box-sizing: border-box;
          background: #2a2216;
          border: 1px solid #3e3220;
          border-radius: 8px;
          padding: 14px;
          color: #f3ecdc;
          text-align: center;
          font-size: 24px;
          letter-spacing: 8px;
          outline: none;
        }

        input:focus {
          border-color: #e8862e;
        }

        button {
          width: 100%;
          margin-top: 18px;
          padding: 12px;
          border: none;
          border-radius: 8px;
          background: #e8862e;
          color: #161209;
          font-weight: 700;
          cursor: pointer;
          transition: .2s;
        }

        button:hover {
          background: #ffb454;
        }

        .error {
          margin-top: 15px;
          color: #e8602e;
          font-size: 13px;
        }

      `}</style>
    </main>
  );
}