import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");

  const logout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <span className="logo-icon">🚗</span>
        <span className="logo-text">Velo<span>Rent</span></span>
      </div>
      <div className="navbar-links">
        {role === "Admin"    && <button className="nav-btn" onClick={() => navigate("/admin")}>Dashboard</button>}
        {role === "Customer" && <button className="nav-btn" onClick={() => navigate("/customer")}>My Portal</button>}
        {role === "Driver"   && <button className="nav-btn" onClick={() => navigate("/driver")}>My Jobs</button>}
      </div>
      <div className="navbar-right">
        <span className="role-badge">{role}</span>
        <button className="logout-btn" onClick={logout}>Logout</button>
      </div>
    </nav>
  );
};

export default Navbar;
