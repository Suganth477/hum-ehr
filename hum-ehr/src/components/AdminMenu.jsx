import React from 'react';
import { Link } from 'react-router-dom';


const AdminMenu = ({ baseUrl, productCode }) => {
  return (
    <>
      <li className="active application-menu-list" data-section="dashboard">
        <Link to={`${baseUrl}${productCode}/dashboard`} className="parent-link">
          <span className="app-menu-icon mdi mdi-view-dashboard"></span>
          <span className="app-menu-description">Dashboard</span>
        </Link>
      </li>
      
      <li className="application-menu-list d-none">
        <ul className="nav-pills nav-stacked d-none sub-menu-ul-list sub-menu-1">
          <li className="application-sub-menu1-list sub-menu-list">
            <Link to="#">
              <span className="app-menu-icon mdi mdi-account-plus"></span>
              <span className="app-menu-description wrapped-text">Enroll Patient & Program</span>
            </Link>
          </li>
          <li className="application-sub-menu1-list sub-menu-list">
            <Link to="#">
              <span className="app-menu-icon mdi mdi-account-injury-outline"></span>
              <span className="app-menu-description">Active Patients</span>
            </Link>
          </li>
          <li className="application-sub-menu1-list sub-menu-list">
            <Link to={`${baseUrl}${productCode}/patients`}>
              <span className="app-menu-icon mdi mdi-hospital-building"></span>
              <span className="app-menu-description">EHR Patients</span>
            </Link>
          </li>
          <li className="application-sub-menu1-list sub-menu-list">
            <Link to="#">
              <span className="app-menu-icon mdi mdi-phone-off"></span>
              <span className="app-menu-description">Unreachable Patients</span>
            </Link>
          </li>
        </ul>
        <Link to="#" className="parent-link">
          <span className="app-menu-icon mdi mdi-account-injury-outline"></span>
          <span className="app-menu-description wrapped-text">Patient Administration</span>
          <span className="mdi mdi-menu-right app-sub-menu-icon"></span>
        </Link>
      </li>

      <li className="application-menu-list">
        <Link to="#" className="parent-link">
          <span className="app-menu-icon mdi mdi-calendar-account-outline"></span>
          <span className="app-menu-description">Appointment</span>
        </Link>
      </li>

      <li className="application-menu-list" data-section="patients">
        <Link to={`${baseUrl}${productCode}/patients`} className="parent-link">
          <span className="app-menu-icon mdi mdi-account-injury-outline"></span>
          <span className="app-menu-description">Patients</span>
        </Link>
      </li>

      <li className="application-menu-list">
        <Link to="#" className="parent-link">
          <span className="app-menu-icon mdi mdi-message-text-outline"></span>
          <span className="app-menu-description wrapped-text">Message Center</span>
        </Link>
      </li>

      <li className="application-menu-list">
        <Link to="#" className="parent-link">
          <span className="app-menu-icon mdi mdi-file-chart-outline"></span>
          <span className="app-menu-description">Reporting</span>
        </Link>
      </li>

      <li className="application-menu-list">
        <Link to="#" className="parent-link">
          <span className="app-menu-icon mdi mdi-cart-plus"></span>
          <span className="app-menu-description wrapped-text">Orders</span>
        </Link>
      </li>

      <li className="application-menu-list">
        <Link to="#" className="parent-link">
          <span className="app-menu-icon mdi mdi-file-sign"></span>
          <span className="app-menu-description">Documentation</span>
        </Link>
      </li>

      <li className="application-menu-list">
        <Link to="#" className="parent-link">
          <span className="app-menu-icon mdi mdi-currency-usd"></span>
          <span className="app-menu-description">Billing</span>
        </Link>
      </li>

      <li className="application-menu-list">
        <Link to={`${baseUrl}${productCode}/users`} className="parent-link">
          <span className="app-menu-icon mdi mdi-account-multiple-plus-outline"></span>
          <span className="app-menu-description wrapped-text">User Management</span>
        </Link>
      </li>

      <li className="application-menu-list">
        <Link to="#" className="parent-link">
          <span className="app-menu-icon mdi mdi-application-cog-outline"></span>
          <span className="app-menu-description wrapped-text">System Configuration</span>
        </Link>
      </li>

      <li className="application-menu-list d-none" data-section="help">
        <Link to={`${baseUrl}${productCode}/help`} className="parent-link">
          <span className="app-menu-icon mdi mdi-help-circle-outline"></span>
          <span className="app-menu-description">Help</span>
        </Link>
      </li>
    </>
  );
};

export default AdminMenu;