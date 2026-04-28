import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import API from "../api/axios";

const Badge = ({ status }) => {
  const map = { Confirmed:"badge-success", Pending:"badge-warning", Cancelled:"badge-danger", Completed:"badge-info" };
  return <span className={`badge ${map[status] || "badge-info"}`}>{status}</span>;
};

export default function DriverDashboard() {
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [toast,    setToast]    = useState(null);
  const [updating, setUpdating] = useState(null);

  const showToast = (msg, type="success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await API.get("/driver/my-bookings");
      setBookings(res.data);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load bookings.", "error");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchBookings(); }, []);

  const updateStatus = async (booking_id, status) => {
    setUpdating(booking_id);
    try {
      await API.post("/driver/update-status", { booking_id, status });
      showToast(`Booking #${booking_id} marked as ${status}`);
      fetchBookings();
    } catch (err) {
      showToast(err.response?.data?.message || "Update failed.", "error");
    } finally { setUpdating(null); }
  };

  const stats = [
    { label:"Total Jobs",     value: bookings.length,                                          icon:"📋", color:"var(--accent)"  },
    { label:"Confirmed",      value: bookings.filter(b=>b.booking_status==="Confirmed").length, icon:"✅", color:"var(--success)" },
    { label:"Pending",        value: bookings.filter(b=>b.booking_status==="Pending").length,   icon:"⏳", color:"var(--warning)" },
    { label:"Completed",      value: bookings.filter(b=>b.booking_status==="Completed").length, icon:"🏁", color:"var(--accent2)" },
  ];

  return (
    <div className="page">
      <Navbar />
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="page-inner">
        <div className="page-header fade-up">
          <div>
            <h1 className="page-title">Driver Dashboard</h1>
            <p className="page-sub">View your assigned bookings and update their status</p>
          </div>
          <button className="btn-outline" onClick={fetchBookings} disabled={loading}>
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        {/* Stats */}
        <div className="stats-row">
          {stats.map((s, i) => (
            <div className="stat-card fade-up" key={i} style={{ animationDelay:`${i*0.08}s` }}>
              <div className="stat-icon" style={{ background: s.color+"22", color: s.color }}>{s.icon}</div>
              <div>
                <div className="stat-value">{loading ? "—" : s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Bookings */}
        {loading && <div className="loading-row"><span className="spinner" /> Loading your bookings...</div>}

        {!loading && bookings.length === 0 && (
          <div className="empty-state fade-up">
            <div className="empty-icon">🚗</div>
            <h3>No bookings assigned yet</h3>
            <p>When an admin assigns a booking to you, it will appear here.</p>
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <div className="booking-cards fade-up">
            {bookings.map(b => (
              <div className="booking-card" key={b.booking_id}>
                <div className="booking-card-header">
                  <span className="id-badge">Booking #{b.booking_id}</span>
                  <Badge status={b.booking_status} />
                </div>
                <div className="booking-card-body">
                  <div className="booking-detail">
                    <span className="detail-label">Vehicle</span>
                    <span>ID #{b.vehicle_id}</span>
                  </div>
                  <div className="booking-detail">
                    <span className="detail-label">Pickup</span>
                    <span>{b.pickup_date?.slice(0,10)}</span>
                  </div>
                  <div className="booking-detail">
                    <span className="detail-label">Return</span>
                    <span>{b.return_date?.slice(0,10)}</span>
                  </div>
                  <div className="booking-detail">
                    <span className="detail-label">Customer</span>
                    <span>ID #{b.customer_id}</span>
                  </div>
                </div>
                <div className="booking-card-actions">
                  {["Confirmed","Completed","Cancelled"].map(status => (
                    <button
                      key={status}
                      className={`status-btn status-${status.toLowerCase()}`}
                      onClick={() => updateStatus(b.booking_id, status)}
                      disabled={updating === b.booking_id || b.booking_status === status}
                    >
                      {updating === b.booking_id ? <span className="spinner" /> : status}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
