import React from 'react';
import { Link } from 'react-router-dom';
import AdminMenu from './AdminMenu';

const Sidebar = ({onmenuClick }) => {
  return (
    <div id="application_side_navigation_menu_container" className="toggled-2 row">
      <div id="sidebar_wrapper" className="hh-ehr-bg-color3 pe-0">
        <ul className="sidebar-nav nav-stacked" id="application_menu_list_container">
          <AdminMenu onmenuClick={onmenuClick} />
        </ul>
        <ul className="sidebar-nav m-0" id="application_menu_settings_container">
          <li className="application-menu-list">
            <Link to="#" className="parent-link user-details-link">
              <span className="app-menu-icon user-profile-icon">
                <img className="profile-image user-profile" src="/src/assets/images/doctor.jpeg" alt="User Profile" />
              </span> 
              <ul className="user-details-list">
                <li className="user-desc">
                  <span className="app-menu-description ms-0 user-name text-truncate text-capitalize">
                    <b>(EST)</b>
                  </span> 
                  <span className="app-menu-description ms-0 user-role text-truncate">Admin</span>
                </li>
                <li className="user-profile-icons">
                  <span className="app-menu-icon me-0 mdi mdi-cog-outline" data-bs-toggle="tooltip" data-bs-placement="top" title="Settings"></span>
                  <span className="app-menu-icon me-0 mdi mdi-logout" data-bs-toggle="tooltip" data-bs-placement="top" title="Logout"></span>
                </li>
              </ul>
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;