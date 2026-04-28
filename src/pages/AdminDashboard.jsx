import { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "../components/Navbar";
import API from "../api/axios";

const Badge = ({ status }) => {
  const map = { Confirmed:"badge-success", Pending:"badge-warning", Cancelled:"badge-danger",
                Completed:"badge-info", Valid:"badge-success", Expired:"badge-danger" };
  return <span className={`badge ${map[status]||"badge-info"}`}>{status}</span>;
};

const Modal = ({ title, onClose, wide, children }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className={`modal-box fade-up ${wide?"modal-wide":""}`} onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h3>{title}</h3><button className="modal-close" onClick={onClose}>✕</button></div>
      <div className="modal-body">{children}</div>
    </div>
  </div>
);

const fmt = n => n != null ? `PKR ${Number(n).toLocaleString()}` : "—";
const POLL = 10000;

export default function AdminDashboard() {
  const [tab,          setTab]          = useState("bookings");
  const [bookings,     setBookings]     = useState([]);
  const [vehicles,     setVehicles]     = useState([]);
  const [drivers,      setDrivers]      = useState([]);
  const [customers,    setCustomers]    = useState([]);
  const [payHistory,   setPayHistory]   = useState([]);
  const [soldHistory,  setSoldHistory]  = useState([]);
  const [purchases,    setPurchases]    = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [toast,        setToast]        = useState(null);
  const [modal,        setModal]        = useState(null);
  const [detailRow,    setDetailRow]    = useState(null);
  const [lastSync,     setLastSync]     = useState(null);
  const pollRef = useRef(null);

  // forms
  const [vForm, setVForm] = useState({ type:"", registration_year:"", make:"", model:"", transmission:"Automatic", mileage:"", rent_per_day:"", photo:"" });
  const [dForm, setDForm] = useState({ name:"", email:"", phone_number:"", address:"", license_number:"", password:"" });
  const [priceForm, setPriceForm] = useState({ purchase_id:"", price:"" });

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };

  const fetchAll = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    try {
      const [b, v, d, c, ph, sh, pur] = await Promise.all([
        API.get("/admin/active-bookings"),
        API.get("/admin/all-vehicles"),
        API.get("/admin/all-drivers"),
        API.get("/admin/all-customers"),
        API.get("/admin/payment-history"),
        API.get("/admin/sold-vehicles"),
        API.get("/admin/pending-purchases"),
      ]);
      setBookings(b.data); setVehicles(v.data); setDrivers(d.data);
      setCustomers(c.data); setPayHistory(ph.data); setSoldHistory(sh.data);
      setPurchases(pur.data);
      setLastSync(new Date());
    } catch { if (!silent) showToast("Failed to load data.", "error"); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(() => fetchAll(true), POLL);
    return () => clearInterval(pollRef.current);
  }, [fetchAll]);

  /* ── actions ── */
  const confirmBooking = async (booking_id, isPaid) => {
    if (!isPaid) { showToast("Cannot confirm — customer payment not received yet.", "error"); return; }
    try {
      await API.post("/admin/confirm-booking", { booking_id });
      showToast(`Booking #${booking_id} confirmed!`); fetchAll(true);
    } catch (err) { showToast(err.response?.data?.error || "Failed.", "error"); }
  };

  const addVehicle = async () => {
    if (!vForm.rent_per_day) { showToast("Per-day rent is required.", "error"); return; }
    try {
      await API.post("/admin/add-vehicle", vForm);
      showToast("Vehicle added!"); setModal(null);
      setVForm({ type:"", registration_year:"", make:"", model:"", transmission:"Automatic", mileage:"", rent_per_day:"", photo:"" });
      fetchAll(true);
    } catch (err) { showToast(err.response?.data?.error || "Failed.", "error"); }
  };

  const removeVehicle = async (vehicle_id, name) => {
    if (!window.confirm(`Remove "${name}"?`)) return;
    try { await API.delete(`/admin/remove-vehicle/${vehicle_id}`); showToast("Vehicle removed."); fetchAll(true); }
    catch (err) { showToast(err.response?.data?.error || "Cannot remove — active bookings exist.", "error"); }
  };

  const addDriver = async () => {
    try {
      await API.post("/admin/add-driver", dForm);
      showToast("Driver added!"); setModal(null);
      setDForm({ name:"", email:"", phone_number:"", address:"", license_number:"", password:"" });
      fetchAll(true);
    } catch (err) { showToast(err.response?.data?.error || "Failed.", "error"); }
  };

  const removeDriver = async (driver_id, name) => {
    if (!window.confirm(`Remove driver "${name}"?`)) return;
    try { await API.delete(`/admin/remove-driver/${driver_id}`); showToast("Driver removed."); fetchAll(true); }
    catch (err) { showToast(err.response?.data?.error || "Cannot remove — active bookings.", "error"); }
  };

  const setPurchasePrice = async () => {
    if (!priceForm.price || priceForm.price <= 0) { showToast("Enter a valid price.", "error"); return; }
    try {
      await API.post("/admin/set-purchase-price", priceForm);
      showToast("Price set! Customer can now pay."); setModal(null); setPriceForm({ purchase_id:"", price:"" });
      fetchAll(true);
    } catch (err) { showToast(err.response?.data?.error || "Failed.", "error"); }
  };

  const completePurchase = async (purchase_id, isPaid) => {
    if (!isPaid) { showToast("Cannot complete — customer payment not received yet.", "error"); return; }
    try {
      await API.post("/admin/complete-purchase", { purchase_id });
      showToast(`Purchase #${purchase_id} completed! Vehicle marked as sold.`); fetchAll(true);
    } catch (err) { showToast(err.response?.data?.error || "Failed.", "error"); }
  };

  const setV = f => e => setVForm(p => ({...p,[f]:e.target.value}));
  const setD = f => e => setDForm(p => ({...p,[f]:e.target.value}));

  const TABS = [
    { key:"bookings",  label:"📋 Bookings"        },
    { key:"purchases", label:"🏷️ Purchases"        },
    { key:"vehicles",  label:"🚗 Vehicles"         },
    { key:"drivers",   label:"👤 Drivers"          },
    { key:"customers", label:"🧑 Customers"        },
    { key:"payments",  label:"💳 Payment History"  },
    { key:"sold",      label:"🏆 Sold Vehicles"    },
  ];

  const stats = [
    { label:"Active Bookings", value:bookings.length,   icon:"📋", color:"var(--accent)"  },
    { label:"Total Vehicles",  value:vehicles.length,   icon:"🚗", color:"var(--accent2)" },
    { label:"Drivers",         value:drivers.length,    icon:"👤", color:"var(--accent3)" },
    { label:"Customers",       value:customers.length,  icon:"🧑", color:"var(--success)" },
    { label:"Sold",            value:soldHistory.length,icon:"🏷️", color:"var(--warning)" },
  ];

  return (
    <div className="page">
      <Navbar/>
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="page-inner">
        <div className="page-header fade-up">
          <div>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-sub">
              Full system control
              {lastSync && <span className="sync-indicator"> · <span className="sync-dot"/> {lastSync.toLocaleTimeString()}</span>}
            </p>
          </div>
          <div className="header-actions">
            <button className="btn-accent"  onClick={()=>setModal("vehicle")}>+ Add Vehicle</button>
            <button className="btn-accent2" onClick={()=>setModal("driver")}>+ Add Driver</button>
            <button className="btn-outline" onClick={()=>setModal("price")}>💰 Set Purchase Price</button>
            <button className="btn-outline" onClick={()=>fetchAll()} disabled={loading}>↻ Refresh</button>
          </div>
        </div>

        <div className="sync-banner fade-up">
          <span className="sync-pulse"/> All admins see live data. Changes reflect for everyone within {POLL/1000}s.
        </div>

        <div className="stats-row">
          {stats.map((s,i)=>(
            <div className="stat-card fade-up" key={i} style={{animationDelay:`${i*0.07}s`}}>
              <div className="stat-icon" style={{background:s.color+"22",color:s.color}}>{s.icon}</div>
              <div><div className="stat-value">{loading?"—":s.value}</div><div className="stat-label">{s.label}</div></div>
            </div>
          ))}
        </div>

        <div className="tabs">
          {TABS.map(t=>(
            <button key={t.key} className={`tab-btn ${tab===t.key?"active":""}`} onClick={()=>setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {loading && <div className="loading-row"><span className="spinner"/> Loading...</div>}

        {/* ── BOOKINGS TAB ── */}
        {!loading && tab==="bookings" && (
          <div className="table-card fade-up">
            <div className="table-note">💡 Confirm button is only active once the customer has completed payment.</div>
            <table className="data-table">
              <thead><tr><th>#</th><th>Customer</th><th>Vehicle</th><th>Dates</th><th>Total</th><th>Driver</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {bookings.length===0 && <tr><td colSpan={9} className="empty-row">No active bookings</td></tr>}
                {bookings.map(b=>(
                  <tr key={b.booking_id}>
                    <td><span className="id-badge">#{b.booking_id}</span></td>
                    <td><div>{b.customer_name}</div><div className="sub-text">#{b.customer_id} · {b.customer_email}</div></td>
                    <td>{b.vehicle}</td>
                    <td><div>{b.pickup_date?.slice(0,10)}</div><div className="sub-text">→ {b.return_date?.slice(0,10)}</div></td>
                    <td className="amount">{fmt(b.total_amount)}</td>
                    <td>{b.driver_name||<span className="sub-text">Self</span>}</td>
                    <td>
                      <span className={`badge ${b.isPaid?"badge-success":"badge-warning"}`}>
                        {b.isPaid?"Paid":"Awaiting Payment"}
                      </span>
                    </td>
                    <td><Badge status={b.booking_status}/></td>
                    <td>
                      {b.booking_status==="Pending" && (
                        <button
                          className={`action-btn ${b.isPaid?"confirm-btn":""}`}
                          onClick={()=>confirmBooking(b.booking_id, b.isPaid)}
                          title={b.isPaid?"Confirm booking":"Waiting for customer payment"}
                        >
                          {b.isPaid?"✓ Confirm":"⏳ Unpaid"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── PURCHASES TAB ── */}
        {!loading && tab==="purchases" && (
          <div className="table-card fade-up">
            <div className="table-note">
              💡 Workflow: Set price → customer pays → Complete Purchase button activates.
            </div>
            <table className="data-table">
              <thead><tr><th>#</th><th>Customer</th><th>Vehicle</th><th>Price</th><th>Date</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {purchases.length===0 && <tr><td colSpan={8} className="empty-row">No purchase requests</td></tr>}
                {purchases.map(p=>(
                  <tr key={p.purchase_id}>
                    <td><span className="id-badge">#{p.purchase_id}</span></td>
                    <td><div>{p.customer_name}</div><div className="sub-text">#{p.customer_id}</div></td>
                    <td>
                      <div className="vehicle-cell">
                        {p.photo&&<img src={p.photo} alt="" className="table-thumb"/>}
                        {p.vehicle_name}
                      </div>
                    </td>
                    <td className="amount">
                      {p.price>0 ? fmt(p.price) : (
                        <button className="action-btn" onClick={()=>{setPriceForm({purchase_id:p.purchase_id,price:""});setModal("price");}}>
                          Set Price
                        </button>
                      )}
                    </td>
                    <td>{p.date?.slice(0,10)}</td>
                    <td>
                      <span className={`badge ${p.isPaid?"badge-success":"badge-warning"}`}>
                        {p.isPaid?"Paid":p.status==="Confirmed"?"Awaiting Payment":"—"}
                      </span>
                    </td>
                    <td><Badge status={p.status}/></td>
                    <td>
                      {p.status==="Confirmed" && (
                        <button
                          className={`action-btn ${p.isPaid?"confirm-btn":""}`}
                          onClick={()=>completePurchase(p.purchase_id, p.isPaid)}
                          title={p.isPaid?"Complete purchase":"Waiting for customer payment"}
                        >
                          {p.isPaid?"✓ Complete":"⏳ Unpaid"}
                        </button>
                      )}
                      {p.status==="Pending" && (
                        <button className="action-btn" onClick={()=>{setPriceForm({purchase_id:p.purchase_id,price:""});setModal("price");}}>
                          Set Price
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── VEHICLES TAB ── */}
        {!loading && tab==="vehicles" && (
          <div className="vehicle-grid">
            {vehicles.length===0 && <div className="empty-state"><div className="empty-icon">🚗</div><h3>No vehicles</h3></div>}
            {vehicles.map(v=>(
              <div className="vehicle-card" key={v.id}>
                <div className="vehicle-img-wrap">
                  {v.photo?<img src={v.photo} alt="" className="vehicle-img"/>:<div className="vehicle-img-empty"><span>🚗</span><p>No photo</p></div>}
                  <div className="vehicle-type-tag">{v.type}</div>
                  {/* RENTED: vehicle is confirmed-booked and currently out */}
                  {v.isRented && <div className="rented-tag">RENTED</div>}
                  {/* SOLD: purchase completed OR isAvailable=false and not rented */}
                  {!v.isAvailable && !v.isRented && <div className="sold-tag">SOLD</div>}
                </div>
                <div className="vehicle-card-body">
                  <h3 className="vehicle-name">{v.make} <span>{v.model}</span></h3>
                  <p className="vehicle-year">{v.registration_year} · {v.transmission}</p>
                  <div className="vehicle-rent">PKR {Number(v.rent_per_day).toLocaleString()}<span>/day</span></div>
                  {/* Hide Remove button for sold vehicles — they must stay for history */}
                  {v.isAvailable || v.isRented
                    ? <button className="remove-btn" onClick={()=>removeVehicle(v.id,`${v.make} ${v.model}`)}>🗑 Remove</button>
                    : <div className="sold-info-tag">🔒 Sold — cannot remove</div>
                  }
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── DRIVERS TAB ── */}
        {!loading && tab==="drivers" && (
          <div className="table-card fade-up">
            <table className="data-table">
              <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>License</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {drivers.length===0&&<tr><td colSpan={7} className="empty-row">No drivers</td></tr>}
                {drivers.map(d=>(
                  <tr key={d.driver_id}>
                    <td><span className="id-badge">#{d.driver_id}</span></td>
                    <td>{d.name}</td><td>{d.email}</td><td>{d.phone_number}</td><td>{d.license_number}</td>
                    <td><span className={`badge ${d.available?"badge-success":"badge-warning"}`}>{d.available?"Available":"On Duty"}</span></td>
                    <td><button className="remove-btn" onClick={()=>removeDriver(d.driver_id,d.name)}>🗑 Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── CUSTOMERS TAB ── */}
        {!loading && tab==="customers" && (
          <div className="table-card fade-up">
            <table className="data-table">
              <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Address</th><th>License</th><th>Bookings</th></tr></thead>
              <tbody>
                {customers.length===0&&<tr><td colSpan={7} className="empty-row">No customers</td></tr>}
                {customers.map(c=>(
                  <tr key={c.customer_id}>
                    <td><span className="id-badge">#{c.customer_id}</span></td>
                    <td>{c.name}</td><td>{c.email}</td><td>{c.phone_number||"—"}</td>
                    <td>{c.address||"—"}</td><td>{c.license_number||"—"}</td>
                    <td><span className="badge badge-info">{c.total_bookings}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── PAYMENT HISTORY TAB ── */}
        {!loading && tab==="payments" && (
          <div className="table-card fade-up">
            <table className="data-table">
              <thead><tr><th>#</th><th>Booking</th><th>Customer</th><th>Vehicle</th><th>Amount</th><th>Method</th><th>Type</th><th>Paid</th><th></th></tr></thead>
              <tbody>
                {payHistory.length===0&&<tr><td colSpan={9} className="empty-row">No payment history</td></tr>}
                {payHistory.map(p=>(
                  <tr key={p.payment_id}>
                    <td><span className="id-badge">#{p.payment_id}</span></td>
                    <td>{p.booking_id?`#${p.booking_id}`:"—"}</td>
                    <td><div>{p.customer_name}</div><div className="sub-text">#{p.customer_id}</div></td>
                    <td>{p.vehicle_name||"—"}</td>
                    <td className="amount">{fmt(p.amount)}</td>
                    <td>{p.method||"—"}</td>
                    <td><span className={`badge ${p.payment_type==="Booking"?"badge-info":"badge-success"}`}>{p.payment_type}</span></td>
                    <td><span className={`badge ${p.isPaid?"badge-success":"badge-warning"}`}>{p.isPaid?"Paid":"Pending"}</span></td>
                    <td><button className="action-btn" onClick={()=>setDetailRow(p)}>View →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── SOLD VEHICLES TAB ── */}
        {!loading && tab==="sold" && (
          <div className="table-card fade-up">
            <table className="data-table">
              <thead><tr><th>#</th><th>Customer</th><th>Vehicle</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {soldHistory.length===0&&<tr><td colSpan={6} className="empty-row">No sold vehicles yet</td></tr>}
                {soldHistory.map(s=>(
                  <tr key={s.purchase_id}>
                    <td><span className="id-badge">#{s.purchase_id}</span></td>
                    <td><div>{s.customer_name}</div><div className="sub-text">#{s.customer_id}</div></td>
                    <td><div className="vehicle-cell">{s.vehicle_photo&&<img src={s.vehicle_photo} alt="" className="table-thumb"/>}{s.vehicle_name}</div></td>
                    <td className="amount">{fmt(s.purchase_amount)}</td>
                    <td>{s.sold_date?.slice(0,10)}</td>
                    <td><Badge status={s.status}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Payment Detail Modal ── */}
      {detailRow && (
        <Modal title="Transaction Details" wide onClose={()=>setDetailRow(null)}>
          <div className="detail-grid">
            <div className="detail-section"><h4>Payment</h4>
              {[["Payment ID",`#${detailRow.payment_id}`],["Type",detailRow.payment_type],["Amount",fmt(detailRow.amount)],["Method",detailRow.method||"—"],["Status",detailRow.isPaid?"Paid":"Pending"]].map(([l,v])=>(
                <div className="detail-row" key={l}><span>{l}</span><strong>{v}</strong></div>
              ))}
            </div>
            <div className="detail-section"><h4>Customer</h4>
              {[["Name",detailRow.customer_name],["ID",`#${detailRow.customer_id}`],["Email",detailRow.customer_email],["Phone",detailRow.customer_phone||"—"]].map(([l,v])=>(
                <div className="detail-row" key={l}><span>{l}</span><strong>{v}</strong></div>
              ))}
            </div>
            <div className="detail-section"><h4>Vehicle</h4>
              {[["Vehicle",detailRow.vehicle_name],["Rent/Day",fmt(detailRow.rent_per_day)]].map(([l,v])=>(
                <div className="detail-row" key={l}><span>{l}</span><strong>{v}</strong></div>
              ))}
            </div>
            {detailRow.booking_id && (
              <div className="detail-section"><h4>Booking</h4>
                {[["Booking ID",`#${detailRow.booking_id}`],["Pickup",detailRow.pickup_date?.slice(0,10)],["Return",detailRow.return_date?.slice(0,10)],["Total",fmt(detailRow.booking_total)],["Status",detailRow.booking_status]].map(([l,v])=>(
                  <div className="detail-row" key={l}><span>{l}</span><strong>{v}</strong></div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Add Vehicle Modal ── */}
      {modal==="vehicle" && (
        <Modal title="Add New Vehicle" onClose={()=>setModal(null)}>
          <div className="form-row">
            <div className="form-group"><label>Type</label><input className="input" placeholder="SUV" value={vForm.type} onChange={setV("type")}/></div>
            <div className="form-group"><label>Year</label><input className="input" placeholder="2022" value={vForm.registration_year} onChange={setV("registration_year")}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Make</label><input className="input" placeholder="Toyota" value={vForm.make} onChange={setV("make")}/></div>
            <div className="form-group"><label>Model</label><input className="input" placeholder="Corolla" value={vForm.model} onChange={setV("model")}/></div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Transmission</label>
              <select className="input" value={vForm.transmission} onChange={setV("transmission")}><option>Automatic</option><option>Manual</option></select>
            </div>
            <div className="form-group"><label>Mileage (km)</label><input className="input" placeholder="15000" value={vForm.mileage} onChange={setV("mileage")}/></div>
          </div>
          <div className="form-group">
            <label>Per-Day Rent (PKR) <span style={{color:"var(--danger)"}}>*</span></label>
            <input className="input" placeholder="e.g. 5000" value={vForm.rent_per_day} onChange={setV("rent_per_day")}/>
          </div>
          <div className="form-group">
            <label>Photo URL <span className="optional">(optional)</span></label>
            <input className="input" placeholder="https://..." value={vForm.photo} onChange={setV("photo")}/>
          </div>
          {vForm.photo&&<div className="photo-preview"><img src={vForm.photo} alt="preview" onError={e=>e.target.style.display="none"}/></div>}
          <button className="btn-primary" onClick={addVehicle}>Add Vehicle</button>
        </Modal>
      )}

      {/* ── Add Driver Modal ── */}
      {modal==="driver" && (
        <Modal title="Add New Driver" onClose={()=>setModal(null)}>
          {[["Full Name","name","Ahmed Raza"],["Email","email","ahmed@gmail.com"],["Phone","phone_number","03001234567"],["Address","address","Lahore"],["License No.","license_number","LIC-XXX"],["Password","password",""]].map(([label,field,ph])=>(
            <div className="form-group" key={field}>
              <label>{label}</label>
              <input className="input" type={field==="password"?"password":"text"} placeholder={ph} value={dForm[field]} onChange={setD(field)}/>
            </div>
          ))}
          <button className="btn-primary" onClick={addDriver}>Add Driver</button>
        </Modal>
      )}

      {/* ── Set Purchase Price Modal ── */}
      {modal==="price" && (
        <Modal title="💰 Set Purchase Price" onClose={()=>setModal(null)}>
          <p className="modal-hint">Enter the Purchase ID and final agreed price. This will notify the customer to proceed with payment.</p>
          <div className="form-group">
            <label>Purchase ID</label>
            <input className="input" placeholder="e.g. 1" value={priceForm.purchase_id} onChange={e=>setPriceForm(p=>({...p,purchase_id:e.target.value}))}/>
          </div>
          <div className="form-group">
            <label>Final Price (PKR)</label>
            <input className="input" placeholder="e.g. 3500000" value={priceForm.price} onChange={e=>setPriceForm(p=>({...p,price:e.target.value}))}/>
          </div>
          <button className="btn-primary" onClick={setPurchasePrice}>Set Price & Notify Customer</button>
        </Modal>
      )}
    </div>
  );
}