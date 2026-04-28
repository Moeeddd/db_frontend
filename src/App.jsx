import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login            from "./pages/Login";
import Register         from "./pages/Register";
import AdminDashboard   from "./pages/AdminDashboard";
import CustomerDashboard from "./pages/CustomerDashboard";
import DriverDashboard  from "./pages/DriverDashboard";
import ProtectedRoute   from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/admin" element={
          <ProtectedRoute role="Admin">
            <AdminDashboard />
          </ProtectedRoute>
        } />

        <Route path="/customer" element={
          <ProtectedRoute role="Customer">
            <CustomerDashboard />
          </ProtectedRoute>
        } />

        <Route path="/driver" element={
          <ProtectedRoute role="Driver">
            <DriverDashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
