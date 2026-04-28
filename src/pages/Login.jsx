import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api/axios";

export default function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    try {
      const res = await API.post("/auth/login", { email, password });
      localStorage.setItem("token",    res.data.token);
      localStorage.setItem("role",     res.data.role);
      localStorage.setItem("entityId", res.data.entityId ?? "");   // customer_id or driver_id

      if      (res.data.role === "Admin")    navigate("/admin");
      else if (res.data.role === "Customer") navigate("/customer");
      else                                   navigate("/driver");
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || "Login failed.");
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand">
          <div className="brand-icon">🚗</div>
          <h1>Velo<span>Rent</span></h1>
          <p>Vehicle Subscription Management System</p>
        </div>
        <div className="auth-stats">
          <div className="stat"><span className="stat-num">20+</span><span className="stat-label">Vehicles</span></div>
          <div className="stat"><span className="stat-num">3</span><span className="stat-label">Roles</span></div>
          <div className="stat"><span className="stat-num">100%</span><span className="stat-label">Secure</span></div>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-card fade-up">
          <h2>Welcome back</h2>
          <p className="auth-sub">Sign in to your account to continue</p>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>Email address</label>
            <input className="input" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==="Enter" && handleLogin()} />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="input" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==="Enter" && handleLogin()} />
          </div>
          <button className="btn-primary" onClick={handleLogin} disabled={loading}>
            {loading ? <span className="spinner" /> : "Sign In →"}
          </button>
          <p className="auth-footer">Don't have an account? <Link to="/register">Register here</Link></p>
          <div className="demo-accounts">
            <p className="demo-title">Demo credentials</p>
            <div className="demo-grid">
              <div className="demo-item"><strong>Admin</strong><span>admin@gmail.pk / 123456</span></div>
              <div className="demo-item"><strong>Customer</strong><span>ali@gmail.com / 123456</span></div>
              <div className="demo-item"><strong>Driver</strong><span>driver@gmail.com / 123456</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
