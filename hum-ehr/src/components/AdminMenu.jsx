import React from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";

const AdminMenu = ({
  userRoleCode,
  physicianAdminFlag,
  clinicianAdminFlag,
}) => {
  const navigate = useNavigate();

  // Custom Role Gate Verification Matching the exact logic inside admin.jsp
  const hasAdministrationAccess = () => {
    const role = userRoleCode?.toUpperCase();
    if (role === "PHYSICIAN" && physicianAdminFlag === "Y") return true;
    if (role === "CLINICIAN" && clinicianAdminFlag === "Y") return true;
    if (role === "CARE_ADMIN") return true;
    return false;
  };

  return (
    <>
      <li
        className="active application-menu-list"
        data-section="dashboard"
        onClick={() => navigate("/dashboard")}
      >
        <a href="#" className="parent-link" onClick={(e) => e.preventDefault()}>
          <span className="app-menu-icon mdi mdi-view-dashboard"></span>
          <span className="app-menu-description">Dashboard</span>
        </a>
      </li>

      {/* Legacy Patient Administration Nesting Tree */}
      <li className="application-menu-list d-none">
        <ul className="nav-pills nav-stacked d-none sub-menu-ul-list sub-menu-1">
          <li className="application-sub-menu1-list sub-menu-list">
            <a href="#" onClick={(e) => e.preventDefault()}>
              <span className="app-menu-icon mdi mdi-account-plus"></span>
              <span className="app-menu-description wrapped-text">
                Enroll Patient & Program
              </span>
            </a>
          </li>
          <li className="application-sub-menu1-list sub-menu-list">
            <a href="#" onClick={(e) => e.preventDefault()}>
              <span className="app-menu-icon mdi mdi-account-injury-outline"></span>
              <span className="app-menu-description">Active Patients</span>
            </a>
          </li>
          <li
            className="application-sub-menu1-list sub-menu-list"
            onClick={() => navigate("/patients")}
          >
            <a href="#" onClick={(e) => e.preventDefault()}>
              <span className="app-menu-icon mdi mdi-hospital-building"></span>
              <span className="app-menu-description">EHR Patients</span>
            </a>
          </li>
          <li className="application-sub-menu1-list sub-menu-list">
            <a href="#" onClick={(e) => e.preventDefault()}>
              <span className="app-menu-icon mdi mdi-phone-off"></span>
              <span className="app-menu-description">Unreachable Patients</span>
            </a>
          </li>
        </ul>
        <a href="javascript:void(0)" className="parent-link">
          <span className="app-menu-icon mdi mdi-account-injury-outline"></span>
          <span className="app-menu-description wrapped-text">
            Patient Administration
          </span>
          <span className="mdi mdi-menu-right app-sub-menu-icon"></span>
        </a>
      </li>

      <li className="application-menu-list">
        <a href="#" className="parent-link" onClick={(e) => e.preventDefault()}>
          <span className="app-menu-icon mdi mdi-calendar-account-outline"></span>
          <span className="app-menu-description">Appointment</span>
        </a>
      </li>

      <li
        className="application-menu-list"
        data-section="patients"
        onClick={() => navigate("/patients")}
      >
        <a href="#" className="parent-link" onClick={(e) => e.preventDefault()}>
          <span className="app-menu-icon mdi mdi-account-injury-outline"></span>
          <span className="app-menu-description">Patients</span>
        </a>
      </li>

      <li
        className="application-menu-list"
        onClick={() => navigate("/message-center")}
      >
        <a href="#" className="parent-link" onClick={(e) => e.preventDefault()}>
          <span className="app-menu-icon mdi mdi-message-text-outline"></span>
          <span className="app-menu-description wrapped-text">
            Message Center
          </span>
        </a>
      </li>

      <li className="application-menu-list">
        <a
          href="#"
          className="parent-link"
          onClick={() => navigate("/reports")}
        >
          <span className="app-menu-icon mdi mdi-file-chart-outline"></span>
          <span className="app-menu-description">Reports</span>
        </a>
      </li>

      <li
        className="application-menu-list"
        data-section="orders"
        onClick={() => navigate("/orders")}
      >
        <a href="#" className="parent-link" onClick={(e) => e.preventDefault()}>
          <span className="app-menu-icon mdi mdi-cart-plus"></span>
          <span className="app-menu-description wrapped-text">Orders</span>
        </a>
      </li>

      <li className="application-menu-list">
        <a
          href="#"
          className="parent-link"
          onClick={() => navigate("/referral")}
        >
          <span className="app-menu-icon">
            <i
              className="fa-solid fa-people-arrows"
              style={{ height: "18px", width: "22px" }}
            ></i>
          </span>
          <span className="app-menu-description">Referral</span>
        </a>
      </li>

      <li className="application-menu-list">
        <a href="#" className="parent-link" onClick={(e) => e.preventDefault()}>
          <span className="app-menu-icon mdi mdi-file-sign"></span>
          <span className="app-menu-description">Documentation</span>
        </a>
      </li>

      <li className="application-menu-list">
        <a href="#" className="parent-link" onClick={(e) => e.preventDefault()}>
          <span className="app-menu-icon mdi mdi-currency-usd"></span>
          <span className="app-menu-description">Billing</span>
        </a>
      </li>

      {/* Role-Gated Admin Section */}
      {hasAdministrationAccess() && (
        <li className="application-menu-list">
          <a
            href="/usermanagement"
            className="parent-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="app-menu-icon mdi mdi-application-cog-outline"></span>
            <span className="app-menu-description wrapped-text">
              Administration
            </span>
          </a>
        </li>
      )}

      <li className="application-menu-list d-none" data-section="help">
        <a href="#" className="parent-link" onClick={() => navigate("/help")}>
          <span className="app-menu-icon mdi mdi-help-circle-outline"></span>
          <span className="app-menu-description">Help</span>
        </a>
      </li>
    </>
  );
};

export default AdminMenu;