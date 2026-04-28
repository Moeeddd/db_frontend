import { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar";
import API from "../api/axios";

/* ── shared helpers ── */
const Modal = ({ title, onClose, wide, children }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className={`modal-box fade-up ${wide ? "modal-wide" : ""}`} onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h3>{title}</h3>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">{children}</div>
    </div>
  </div>
);

const Badge = ({ status }) => {
  const map = { Confirmed: "badge-success", Pending: "badge-warning", Cancelled: "badge-danger", Completed: "badge-info" };
  return <span className={`badge ${map[status] || "badge-info"}`}>{status}</span>;
};

const fmt = n => (n != null && n > 0) ? `PKR ${Number(n).toLocaleString()}` : "—";
const daysBetween = (a, b) => Math.max(1, Math.ceil((new Date(b) - new Date(a)) / 86400000));

const METHODS = ["Cash", "JazzCash", "Credit Card", "Bank Transfer"];

export default function CustomerDashboard() {
  const [tab,         setTab]         = useState("browse");
  const [vehicles,    setVehicles]    = useState([]);
  const [drivers,     setDrivers]     = useState([]);
  const [bookHistory, setBookHistory] = useState([]);
  const [myPurchases, setMyPurchases] = useState([]);
  const [loadingPage, setLoadingPage] = useState(false);
  const [toast,       setToast]       = useState(null);

  // flow state
  const [selectedCar,  setSelectedCar]  = useState(null);
  const [bookingCar,   setBookingCar]   = useState(null);
  const [purchaseCar,  setPurchaseCar]  = useState(null);
  const [pickDriver,   setPickDriver]   = useState(false);
  const [chosenDriver, setChosenDriver] = useState(null);
  const [billModal,    setBillModal]    = useState(null);

  // payment state — no manual IDs
  const [payTarget,    setPayTarget]    = useState(null);  // { type: 'booking'|'purchase', id, amount, vehicle }
  const [payMethod,    setPayMethod]    = useState("Cash");
  const [payLoading,   setPayLoading]   = useState(false);

  const [pickupDate, setPickupDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [search,     setSearch]     = useState("");
  const [filterType, setFilterType] = useState("All");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoadingPage(true);
    try {
      const [v, d, bh, mp] = await Promise.all([
        API.get("/customer/available-vehicles"),
        API.get("/customer/available-drivers"),
        API.get("/customer/my-bookings"),
        API.get("/customer/my-purchases"),
      ]);
      setVehicles(v.data);
      setDrivers(d.data);
      setBookHistory(bh.data);
      setMyPurchases(mp.data);
    } catch { }
    finally { if (!silent) setLoadingPage(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /* ── computed ── */
  const days = pickupDate && returnDate ? daysBetween(pickupDate, returnDate) : 0;
  const totalAmount = bookingCar ? days * bookingCar.rent_per_day : 0;
  const types = ["All", ...new Set(vehicles.map(v => v.type))];
  const filtered = vehicles.filter(v =>
    `${v.make} ${v.model}`.toLowerCase().includes(search.toLowerCase()) &&
    (filterType === "All" || v.type === filterType)
  );

  /* ── pending payments summary ── */
  const unpaidBookings  = bookHistory.filter(b => !b.isPaid && b.booking_status !== "Cancelled");
  const unpaidPurchases = myPurchases.filter(p => !p.is_paid && p.status === "Confirmed" && p.price > 0);
  const totalPendingPayments = unpaidBookings.length + unpaidPurchases.length;

  /* ── book vehicle ── */
  const bookVehicle = async () => {
    if (!pickupDate || !returnDate) { showToast("Select pickup and return dates.", "error"); return; }
    if (new Date(returnDate) <= new Date(pickupDate)) { showToast("Return date must be after pickup date.", "error"); return; }
    setLoadingPage(true);
    try {
      const res = await API.post("/customer/book-vehicle", {
        vehicle_id:  bookingCar.id,
        driver_id:   chosenDriver?.driver_id || null,
        pickup_date: pickupDate,
        return_date: returnDate,
      });
      const bill = {
        booking_id: res.data.booking_id, vehicle: `${bookingCar.make} ${bookingCar.model}`,
        photo: bookingCar.photo, pickup_date: pickupDate, return_date: returnDate,
        days, rent_per_day: bookingCar.rent_per_day,
        total_amount: res.data.total_amount, driver: chosenDriver?.name || "Self-drive",
      };
      setBookingCar(null); setSelectedCar(null); setPickDriver(false);
      setChosenDriver(null); setPickupDate(""); setReturnDate("");
      setBillModal(bill);
      loadAll(true);
      showToast("Booking submitted! Now complete payment to get admin confirmation.");
    } catch (err) { showToast(err.response?.data?.error || "Booking failed.", "error"); }
    finally { setLoadingPage(false); }
  };

  /* ── purchase vehicle ── */
  const purchaseVehicle = async () => {
    setLoadingPage(true);
    try {
      await API.post("/customer/purchase-vehicle", { vehicle_id: purchaseCar.id });
      showToast("Purchase request submitted! Admin will set the price and confirm it.");
      setPurchaseCar(null); setSelectedCar(null);
      loadAll(true);
    } catch (err) { showToast(err.response?.data?.error || "Purchase failed.", "error"); }
    finally { setLoadingPage(false); }
  };

  /* ── pay — no manual ID, uses payTarget set by clicking Pay button ── */
  const submitPayment = async () => {
    if (!payTarget || !payMethod) return;
    setPayLoading(true);
    try {
      let res;
      if (payTarget.type === "booking") {
        res = await API.post("/customer/pay-booking", { booking_id: payTarget.id, method: payMethod });
      } else {
        res = await API.post("/customer/pay-purchase", { purchase_id: payTarget.id, method: payMethod });
      }
      showToast(`Payment of PKR ${Number(res.data.amount).toLocaleString()} successful!`);
      setPayTarget(null); setPayMethod("Cash");
      loadAll(true);
    } catch (err) { showToast(err.response?.data?.error || "Payment failed.", "error"); }
    finally { setPayLoading(false); }
  };

  const closeBooking = () => {
    setBookingCar(null); setSelectedCar(null); setPickDriver(false);
    setChosenDriver(null); setPickupDate(""); setReturnDate("");
  };

  return (
    <div className="page">
      <Navbar />
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="page-inner">
        {/* Header */}
        <div className="page-header fade-up">
          <div>
            <h1 className="page-title">Customer Portal</h1>
            <p className="page-sub">Browse vehicles, book, purchase and manage your payments</p>
          </div>
          {/* Payments alert badge */}
          {totalPendingPayments > 0 && (
            <button className="pay-alert-btn" onClick={() => setTab("payments")}>
              💳 {totalPendingPayments} Payment{totalPendingPayments > 1 ? "s" : ""} Pending
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[
            { key: "browse",   label: "🚗 Browse Vehicles" },
            { key: "payments", label: `💳 My Payments${totalPendingPayments > 0 ? ` (${totalPendingPayments})` : ""}` },
            { key: "history",  label: "📋 My Bookings" },
            { key: "purchases",label: "🏷️ My Purchases" },
          ].map(t => (
            <button key={t.key} className={`tab-btn ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── BROWSE TAB ── */}
        {tab === "browse" && (
          <>
            <div className="vehicle-toolbar fade-up">
              <input className="input search-input" placeholder="🔍  Search make or model..."
                value={search} onChange={e => setSearch(e.target.value)} />
              <div className="type-filters">
                {types.map(t => (
                  <button key={t} className={`type-pill ${filterType === t ? "active" : ""}`}
                    onClick={() => setFilterType(t)}>{t}</button>
                ))}
              </div>
            </div>

            {!loadingPage && <p className="vehicle-count fade-in">{filtered.length} vehicle{filtered.length !== 1 ? "s" : ""} available</p>}

            {loadingPage && (
              <div className="vehicle-grid">
                {[...Array(6)].map((_, i) => (
                  <div className="vehicle-card skeleton" key={i}>
                    <div className="skeleton-img" /><div className="skeleton-line" /><div className="skeleton-line short" />
                  </div>
                ))}
              </div>
            )}

            {!loadingPage && filtered.length === 0 && (
              <div className="empty-state fade-up"><div className="empty-icon">🚗</div><h3>No vehicles found</h3><p>Try adjusting your search.</p></div>
            )}

            {!loadingPage && (
              <div className="vehicle-grid">
                {filtered.map((v, i) => (
                  <div className="vehicle-card fade-up" key={v.id} style={{ animationDelay: `${i * 0.05}s` }} onClick={() => setSelectedCar(v)}>
                    <div className="vehicle-img-wrap">
                      {v.photo ? <img src={v.photo} alt="" className="vehicle-img" /> : <div className="vehicle-img-empty"><span>🚗</span><p>No photo</p></div>}
                      <div className="vehicle-type-tag">{v.type}</div>
                    </div>
                    <div className="vehicle-card-body">
                      <h3 className="vehicle-name">{v.make} <span>{v.model}</span></h3>
                      <p className="vehicle-year">{v.registration_year} · {v.transmission}</p>
                      <div className="vehicle-card-footer">
                        <span className="vehicle-rent-badge">PKR {Number(v.rent_per_day).toLocaleString()}/day</span>
                        <span className="view-specs-hint">View specs →</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── PAYMENTS TAB ── */}
        {tab === "payments" && (
          <div className="payments-view fade-up">
            <div className="payments-intro">
              <h3>💳 Your Pending Payments</h3>
              <p>Click <strong>Pay Now</strong> on any row to complete payment. No IDs to enter — just choose your method and confirm.</p>
            </div>

            {/* Booking payments */}
            <div className="pay-section">
              <h4 className="pay-section-title">📋 Booking Payments</h4>
              {unpaidBookings.length === 0
                ? <div className="pay-empty">No pending booking payments. All bookings are paid ✓</div>
                : unpaidBookings.map(b => (
                  <div className="pay-card" key={b.booking_id}>
                    <div className="pay-card-left">
                      {b.photo && <img src={b.photo} alt="" className="pay-thumb" />}
                      <div>
                        <div className="pay-card-title">{b.vehicle}</div>
                        <div className="pay-card-meta">
                          Booking #{b.booking_id} &nbsp;·&nbsp;
                          {b.pickup_date?.slice(0, 10)} → {b.return_date?.slice(0, 10)} &nbsp;·&nbsp;
                          {daysBetween(b.pickup_date, b.return_date)} days
                        </div>
                        <div className="pay-card-meta">
                          Status: <Badge status={b.booking_status} />
                          {b.booking_status === "Pending" && <span className="pay-note"> — Admin will confirm after payment</span>}
                        </div>
                      </div>
                    </div>
                    <div className="pay-card-right">
                      <div className="pay-amount">{fmt(b.total_amount)}</div>
                      <button className="pay-now-btn"
                        onClick={() => setPayTarget({ type: "booking", id: b.booking_id, amount: b.total_amount, vehicle: b.vehicle })}>
                        Pay Now →
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>

            {/* Purchase payments */}
            <div className="pay-section">
              <h4 className="pay-section-title">🏷️ Purchase Payments</h4>
              {unpaidPurchases.length === 0
                ? <div className="pay-empty">
                    No pending purchase payments.
                    {myPurchases.some(p => p.status === "Pending") &&
                      <span> Some purchase requests are awaiting admin price confirmation.</span>}
                  </div>
                : unpaidPurchases.map(p => (
                  <div className="pay-card" key={p.purchase_id}>
                    <div className="pay-card-left">
                      {p.photo && <img src={p.photo} alt="" className="pay-thumb" />}
                      <div>
                        <div className="pay-card-title">{p.vehicle}</div>
                        <div className="pay-card-meta">Purchase #{p.purchase_id} &nbsp;·&nbsp; {p.date?.slice(0, 10)}</div>
                        <div className="pay-card-meta">Status: <Badge status={p.status} /></div>
                      </div>
                    </div>
                    <div className="pay-card-right">
                      <div className="pay-amount">{fmt(p.price)}</div>
                      <button className="pay-now-btn"
                        onClick={() => setPayTarget({ type: "purchase", id: p.purchase_id, amount: p.price, vehicle: p.vehicle })}>
                        Pay Now →
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>

            {/* All purchases awaiting admin confirmation */}
            {myPurchases.filter(p => p.status === "Pending").length > 0 && (
              <div className="pay-section">
                <h4 className="pay-section-title">⏳ Awaiting Admin Price Confirmation</h4>
                {myPurchases.filter(p => p.status === "Pending").map(p => (
                  <div className="pay-card pay-card-waiting" key={p.purchase_id}>
                    <div className="pay-card-left">
                      {p.photo && <img src={p.photo} alt="" className="pay-thumb" />}
                      <div>
                        <div className="pay-card-title">{p.vehicle}</div>
                        <div className="pay-card-meta">Purchase #{p.purchase_id} &nbsp;·&nbsp; Submitted {p.date?.slice(0, 10)}</div>
                      </div>
                    </div>
                    <div className="pay-card-right">
                      <span className="badge badge-warning">Awaiting Price</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── BOOKING HISTORY TAB ── */}
        {tab === "history" && (
          <div className="table-card fade-up">
            <table className="data-table">
              <thead><tr><th>#</th><th>Vehicle</th><th>Pickup</th><th>Return</th><th>Days</th><th>Total</th><th>Driver</th><th>Payment</th><th>Status</th></tr></thead>
              <tbody>
                {bookHistory.length === 0 && <tr><td colSpan={9} className="empty-row">No bookings yet</td></tr>}
                {bookHistory.map(b => {
                  const d = daysBetween(b.pickup_date, b.return_date);
                  return (
                    <tr key={b.booking_id}>
                      <td><span className="id-badge">#{b.booking_id}</span></td>
                      <td><div className="vehicle-cell">{b.photo && <img src={b.photo} alt="" className="table-thumb" />}{b.vehicle}</div></td>
                      <td>{b.pickup_date?.slice(0, 10)}</td>
                      <td>{b.return_date?.slice(0, 10)}</td>
                      <td>{d}d</td>
                      <td className="amount">{fmt(b.total_amount)}</td>
                      <td>{b.driver_name || <span className="sub-text">Self</span>}</td>
                      <td>
                        {b.isPaid
                          ? <span className="badge badge-success">Paid</span>
                          : b.booking_status !== "Cancelled"
                            ? <button className="pay-inline-btn" onClick={() => { setPayTarget({ type: "booking", id: b.booking_id, amount: b.total_amount, vehicle: b.vehicle }); setTab("payments"); }}>Pay →</button>
                            : <span className="badge badge-danger">Cancelled</span>
                        }
                      </td>
                      <td><Badge status={b.booking_status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── PURCHASES TAB ── */}
        {tab === "purchases" && (
          <div className="table-card fade-up">
            <table className="data-table">
              <thead><tr><th>#</th><th>Vehicle</th><th>Type</th><th>Year</th><th>Price</th><th>Date</th><th>Payment</th><th>Status</th></tr></thead>
              <tbody>
                {myPurchases.length === 0 && <tr><td colSpan={8} className="empty-row">No purchases yet</td></tr>}
                {myPurchases.map(p => (
                  <tr key={p.purchase_id}>
                    <td><span className="id-badge">#{p.purchase_id}</span></td>
                    <td><div className="vehicle-cell">{p.photo && <img src={p.photo} alt="" className="table-thumb" />}{p.vehicle}</div></td>
                    <td>{p.type}</td>
                    <td>{p.registration_year}</td>
                    <td className="amount">{p.price > 0 ? fmt(p.price) : <span className="sub-text">Pending admin</span>}</td>
                    <td>{p.date?.slice(0, 10)}</td>
                    <td>
                      {p.is_paid
                        ? <span className="badge badge-success">Paid</span>
                        : p.status === "Confirmed" && p.price > 0
                          ? <button className="pay-inline-btn" onClick={() => { setPayTarget({ type: "purchase", id: p.purchase_id, amount: p.price, vehicle: p.vehicle }); setTab("payments"); }}>Pay →</button>
                          : <span className="sub-text">—</span>
                      }
                    </td>
                    <td><Badge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ SPEC MODAL ══ */}
      {selectedCar && !bookingCar && !purchaseCar && (
        <div className="modal-overlay" onClick={() => setSelectedCar(null)}>
          <div className="spec-modal fade-up" onClick={e => e.stopPropagation()}>
            <div className="spec-modal-img">
              {selectedCar.photo ? <img src={selectedCar.photo} alt="" /> : <div className="spec-no-photo"><span>🚗</span><p>No photo</p></div>}
              <button className="modal-close spec-close" onClick={() => setSelectedCar(null)}>✕</button>
              <div className="spec-modal-overlay-text">
                <h2>{selectedCar.make} {selectedCar.model}</h2>
                <span className="vehicle-type-tag">{selectedCar.type}</span>
              </div>
            </div>
            <div className="spec-modal-body">
              <h4 className="spec-section-title">Specifications</h4>
              <div className="spec-grid">
                {[["Make", selectedCar.make], ["Model", selectedCar.model], ["Type", selectedCar.type],
                  ["Year", selectedCar.registration_year], ["Transmission", selectedCar.transmission],
                  ["Mileage", `${selectedCar.mileage?.toLocaleString()} km`],
                  ["Rent / Day", `PKR ${Number(selectedCar.rent_per_day).toLocaleString()}`],
                  ["Vehicle ID", `#${selectedCar.id}`]
                ].map(([l, v]) => (
                  <div className="spec-row" key={l}><span className="spec-label">{l}</span><span className="spec-value">{v}</span></div>
                ))}
              </div>
              <div className="spec-actions">
                <button className="btn-primary" style={{ background: "var(--accent)", color: "#000" }} onClick={() => setBookingCar(selectedCar)}>📅 Book this Vehicle</button>
                <button className="btn-primary" style={{ background: "var(--accent2)", color: "#000" }} onClick={() => { setPurchaseCar(selectedCar); setSelectedCar(null); }}>🏷️ Purchase this Vehicle</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ BOOKING MODAL ══ */}
      {bookingCar && (
        <Modal title={`📅 Book — ${bookingCar.make} ${bookingCar.model}`} wide onClose={closeBooking}>
          <div className="booking-car-summary">
            {bookingCar.photo ? <img src={bookingCar.photo} alt="" className="booking-thumb" /> : <div className="booking-thumb-empty">🚗</div>}
            <div>
              <strong>{bookingCar.make} {bookingCar.model}</strong>
              <p>{bookingCar.registration_year} · {bookingCar.transmission}</p>
              <p className="vehicle-rent-badge" style={{ marginTop: 4 }}>PKR {Number(bookingCar.rent_per_day).toLocaleString()} / day</p>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Pickup Date</label>
              <input className="input" type="date" value={pickupDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={e => setPickupDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Return Date</label>
              <input className="input" type="date" value={returnDate}
                min={pickupDate || new Date().toISOString().split("T")[0]}
                onChange={e => setReturnDate(e.target.value)} />
            </div>
          </div>

          {days > 0 && (
            <div className="cost-calculator">
              <div className="cost-row"><span>Duration</span><strong>{days} day{days !== 1 ? "s" : ""}</strong></div>
              <div className="cost-row"><span>Rate</span><strong>PKR {Number(bookingCar.rent_per_day).toLocaleString()} / day</strong></div>
              <div className="cost-row total-row"><span>Total Rent</span><strong className="amount">PKR {Number(totalAmount).toLocaleString()}</strong></div>
            </div>
          )}

          {/* Driver picker */}
          <div className="driver-section">
            <div className="driver-section-header">
              <span>👤 Driver</span>
              <button className="toggle-driver-btn" onClick={() => { setPickDriver(p => !p); setChosenDriver(null); }}>
                {pickDriver ? "Cancel" : "Add a driver (optional)"}
              </button>
            </div>
            {chosenDriver && !pickDriver && (
              <div className="chosen-driver"><span>✓ {chosenDriver.name}</span><button onClick={() => setChosenDriver(null)}>✕</button></div>
            )}
            {pickDriver && (
              <div className="driver-gallery">
                {drivers.length === 0 && <p className="sub-text">No drivers available right now.</p>}
                {drivers.map(d => (
                  <div key={d.driver_id} className={`driver-card ${chosenDriver?.driver_id === d.driver_id ? "selected" : ""}`}
                    onClick={() => { setChosenDriver(d); setPickDriver(false); }}>
                    <div className="driver-avatar">{d.name[0]}</div>
                    <div><strong>{d.name}</strong><p>{d.phone_number}</p><p className="sub-text">{d.address}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="booking-flow-note">
            💡 After booking, go to <strong>My Payments</strong> tab to complete payment. Admin will confirm once payment is received.
          </div>

          <button className="btn-primary" onClick={bookVehicle} disabled={loadingPage || days <= 0}>
            {loadingPage ? <span className="spinner" /> : days > 0 ? `Submit Booking — PKR ${Number(totalAmount).toLocaleString()} →` : "Select dates to continue"}
          </button>
        </Modal>
      )}

      {/* ══ PURCHASE CONFIRM MODAL ══ */}
      {purchaseCar && (
        <Modal title={`🏷️ Purchase — ${purchaseCar.make} ${purchaseCar.model}`} onClose={() => setPurchaseCar(null)}>
          <div className="booking-car-summary">
            {purchaseCar.photo ? <img src={purchaseCar.photo} alt="" className="booking-thumb" /> : <div className="booking-thumb-empty">🚗</div>}
            <div>
              <strong>{purchaseCar.make} {purchaseCar.model}</strong>
              <p>{purchaseCar.registration_year} · {purchaseCar.transmission} · ID #{purchaseCar.id}</p>
            </div>
          </div>
          <div className="purchase-notice">
            <p>📋 <strong>How it works:</strong></p>
            <p>1. You submit a purchase request.</p>
            <p>2. Admin reviews it and sets the final price.</p>
            <p>3. You pay in the <strong>My Payments</strong> tab.</p>
            <p>4. Admin finalizes — vehicle is exclusively yours.</p>
          </div>
          <button className="btn-primary" style={{ background: "var(--accent2)", color: "#000" }} onClick={purchaseVehicle} disabled={loadingPage}>
            {loadingPage ? <span className="spinner" /> : "Submit Purchase Request →"}
          </button>
        </Modal>
      )}

      {/* ══ BILL MODAL ══ */}
      {billModal && (
        <Modal title="🧾 Booking Submitted" wide onClose={() => setBillModal(null)}>
          <div className="bill">
            <div className="bill-header">
              <div className="bill-logo">🚗 VeloRent</div>
              <Badge status="Pending" />
            </div>
            {billModal.photo && <img src={billModal.photo} alt="" className="bill-car-img" />}
            <h3 className="bill-vehicle">{billModal.vehicle}</h3>
            <div className="bill-rows">
              <div className="bill-row"><span>Booking ID</span><strong>#{billModal.booking_id}</strong></div>
              <div className="bill-row"><span>Pickup Date</span><strong>{billModal.pickup_date}</strong></div>
              <div className="bill-row"><span>Return Date</span><strong>{billModal.return_date}</strong></div>
              <div className="bill-row"><span>Duration</span><strong>{billModal.days} day{billModal.days !== 1 ? "s" : ""}</strong></div>
              <div className="bill-row"><span>Rate</span><strong>PKR {Number(billModal.rent_per_day).toLocaleString()} / day</strong></div>
              <div className="bill-row"><span>Driver</span><strong>{billModal.driver}</strong></div>
              <div className="bill-divider" />
              <div className="bill-row bill-total"><span>Total Amount</span><strong>PKR {Number(billModal.total_amount).toLocaleString()}</strong></div>
            </div>
            <div className="bill-next-step">
              <strong>Next Step:</strong> Go to <strong>My Payments</strong> tab to complete your payment.
              Admin will confirm your booking once payment is received.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button className="btn-primary" style={{ background: "var(--accent)", color: "#000" }}
                onClick={() => { setBillModal(null); setTab("payments"); }}>
                Go to Payments →
              </button>
              <button className="btn-primary" style={{ background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)" }}
                onClick={() => setBillModal(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ PAYMENT METHOD MODAL (no manual ID — auto from payTarget) ══ */}
      {payTarget && (
        <Modal title="💳 Complete Payment" onClose={() => { setPayTarget(null); setPayMethod("Cash"); }}>
          <div className="pay-confirm-box">
            <div className="pay-confirm-vehicle">{payTarget.vehicle}</div>
            <div className="pay-confirm-type">{payTarget.type === "booking" ? "📋 Booking" : "🏷️ Purchase"} #{payTarget.id}</div>
            <div className="pay-confirm-amount">PKR {Number(payTarget.amount).toLocaleString()}</div>
          </div>

          <div className="form-group" style={{ marginTop: 20 }}>
            <label>Select Payment Method</label>
            <div className="method-grid">
              {METHODS.map(m => (
                <button key={m} className={`method-btn ${payMethod === m ? "active" : ""}`} onClick={() => setPayMethod(m)}>
                  {m === "Cash" ? "💵" : m === "JazzCash" ? "📱" : m === "Credit Card" ? "💳" : "🏦"} {m}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary" onClick={submitPayment} disabled={payLoading}>
            {payLoading ? <span className="spinner" /> : `Pay PKR ${Number(payTarget.amount).toLocaleString()} via ${payMethod} →`}
          </button>

          <p className="modal-hint" style={{ marginTop: 12, textAlign: "center" }}>
            {payTarget.type === "booking"
              ? "Once payment is confirmed, admin will approve your booking."
              : "Once payment is confirmed, admin will finalize your purchase."}
          </p>
        </Modal>
      )}
    </div>
  );
}
