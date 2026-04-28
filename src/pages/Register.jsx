import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api/axios";

const ROLES = ["Customer", "Driver", "Admin"];

// Fields shown per role
const FIELDS = {
  Customer: ["name", "email", "phone_number", "address", "license_number", "password"],
  Driver:   ["name", "email", "phone_number", "address", "license_number", "password"],
  Admin:    ["name", "email", "password", "admin_secret"],
};

const LABELS = {
  name:           "Full Name",
  email:          "Email Address",
  phone_number:   "Phone Number",
  address:        "Address",
  license_number: "License Number",
  password:       "Password",
  admin_secret:   "Admin Secret Key",
};

const PLACEHOLDERS = {
  name:           "Ali Khan",
  email:          "ali@gmail.com",
  phone_number:   "03001234567",
  address:        "Lahore, Pakistan",
  license_number: "LIC-XXXX",
  password:       "••••••••",
  admin_secret:   "Enter secret key from .env",
};

const ENDPOINTS = {
  Customer: "/auth/register",
  Driver:   "/auth/register-driver",
  Admin:    "/auth/register-admin",
};

const ROLE_META = {
  Customer: { icon:"🧑", desc:"Book and purchase vehicles, make payments." },
  Driver:   { icon:"🚗", desc:"Accept bookings, update trip status." },
  Admin:    { icon:"🛡️", desc:"Manage the entire system. Requires secret key." },
};

export default function Register() {
  const [role,    setRole]    = useState("Customer");
  const [form,    setForm]    = useState({});
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const switchRole = (r) => { setRole(r); setForm({}); setError(""); setSuccess(""); };

  const handleRegister = async () => {
    // Basic validation — all visible fields required
    const required = FIELDS[role];
    for (const f of required) {
      if (!form[f]) { setError(`${LABELS[f]} is required.`); return; }
    }
    setLoading(true); setError(""); setSuccess("");
    try {
      const res = await API.post(ENDPOINTS[role], form);
      setSuccess(`${role} registered successfully! ${res.data.customer_id ? `Customer ID: ${res.data.customer_id}.` : ""} ${res.data.driver_id ? `Driver ID: ${res.data.driver_id}.` : ""} Redirecting to login...`);
      setTimeout(() => navigate("/"), 2200);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed. Email may already be in use.");
    } finally {
      setLoading(false);
    }
  };

  const fields = FIELDS[role];

  // Split fields into pairs for two-column layout (except password & admin_secret — full width)
  const fullWidthFields = ["password", "admin_secret", "address"];

  return (
    <div className="auth-page">
      {/* Left panel */}
      <div className="auth-left">
        <div className="auth-brand">
          <div className="brand-icon">🚗</div>
          <h1>Velo<span>Rent</span></h1>
          <p>Vehicle Subscription Management System</p>
        </div>

        {/* Role info */}
        <div className="role-info-card">
          <div className="role-info-icon">{ROLE_META[role].icon}</div>
          <div>
            <strong>{role} Account</strong>
            <p>{ROLE_META[role].desc}</p>
          </div>
        </div>

        <ul className="auth-features">
          <li>✓ Secure role-based access</li>
          <li>✓ JWT protected sessions</li>
          <li>✓ Instant account activation</li>
        </ul>
      </div>

      {/* Right panel */}
      <div className="auth-right">
        <div className="auth-card fade-up">
          <h2>Create account</h2>
          <p className="auth-sub">Choose your role and fill in your details</p>

          {/* Role selector */}
          <div className="role-selector">
            {ROLES.map(r => (
              <button
                key={r}
                className={`role-btn ${role === r ? "active" : ""}`}
                onClick={() => switchRole(r)}
              >
                <span>{ROLE_META[r].icon}</span>
                <span>{r}</span>
              </button>
            ))}
          </div>

          {error   && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* Admin secret warning */}
          {role === "Admin" && (
            <div className="alert alert-warning">
              ⚠️ Admin registration requires a secret key set in the server <code>.env</code> file as <code>ADMIN_SECRET</code>.
            </div>
          )}

          {/* Dynamic fields */}
          <div className="fields-grid">
            {fields.map(field => (
              <div
                key={field}
                className={`form-group ${fullWidthFields.includes(field) ? "full-width" : ""}`}
              >
                <label>{LABELS[field]}</label>
                <input
                  className="input"
                  type={field === "password" ? "password" : field === "email" ? "email" : "text"}
                  placeholder={PLACEHOLDERS[field]}
                  value={form[field] || ""}
                  onChange={set(field)}
                />
              </div>
            ))}
          </div>

          <button className="btn-primary" onClick={handleRegister} disabled={loading}>
            {loading ? <span className="spinner" /> : `Register as ${role} →`}
          </button>

          <p className="auth-footer">
            Already have an account? <Link to="/">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
