import React, { useRef, useEffect } from 'react';
// import { Link } from 'react-router-dom';


const AdminMenu = ({onmenuClick}) => {
  return (
    <>
      <li className="active application-menu-list" data-section="dashboard" role="button" tabIndex={0}>
        <span className="app-menu-icon mdi mdi-view-dashboard"></span>
        <span className="app-menu-description">Dashboard</span>
      </li>
      <li className="application-menu-list" role="button" tabIndex={0}>
        <span className="app-menu-icon mdi mdi-calendar-account-outline"></span>
        <span className="app-menu-description">Appointment</span>
      </li>
      <li className="application-menu-list" data-section="patients" role="button" tabIndex={0} onClick={() => onmenuClick('patientList')}>
        <span className="app-menu-icon mdi mdi-account-injury-outline"></span>
        <span className="app-menu-description">Patients</span>
      </li>

      <li className="application-menu-list" role="button" tabIndex={0} onClick={() => onmenuClick('messageCenter')}>
        <span className="app-menu-icon mdi mdi-message-text-outline"></span>
        <span className="app-menu-description wrapped-text">Message Center</span>
      </li>

      <li className="application-menu-list" role="button" tabIndex={0}>
        <span className="app-menu-icon mdi mdi-file-chart-outline"></span>
        <span className="app-menu-description">Reporting</span>
      </li>

      <li className="application-menu-list" role="button" tabIndex={0}>
        <span className="app-menu-icon mdi mdi-cart-plus"></span>
        <span className="app-menu-description wrapped-text">Orders</span>
      </li>

      <li className="application-menu-list" role="button" tabIndex={0}>
        <span className="app-menu-icon mdi mdi-file-sign"></span>
        <span className="app-menu-description">Documentation</span>
      </li>

      <li className="application-menu-list" role="button" tabIndex={0}>
        <span className="app-menu-icon mdi mdi-currency-usd"></span>
        <span className="app-menu-description">Billing</span>
      </li>

      <li className="application-menu-list" data-section="patients" role="button" tabIndex={0} onClick={() => onmenuClick('administration')}>
        <span className="app-menu-icon mdi mdi-account-multiple-plus-outline"></span>
        <span className="app-menu-description wrapped-text">User Management</span>
      </li>

      <li className="application-menu-list" role="button" tabIndex={0}>
        <span className="app-menu-icon mdi mdi-application-cog-outline"></span>
        <span className="app-menu-description wrapped-text">System Configuration</span>
      </li>

      <li className="application-menu-list d-none" data-section="help" role="button" tabIndex={0}>
        <span className="app-menu-icon mdi mdi-help-circle-outline"></span>
        <span className="app-menu-description">Help</span>
      </li>
    </>
  );
};
export default AdminMenu;