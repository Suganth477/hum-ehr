import React from 'react';
import AdminMenu from './AdminMenu';
import doctorImage from "../assets/images/doctor.jpeg";

const Sidebar = ({ userLoginDetails, userFullName}) => {
  return (
    <div id="application_side_navigation_menu_container" className="toggled-2 row">
      <div id="sidebar_wrapper" className="hh-ehr-bg-color3 pe-0">
        <ul className="sidebar-nav nav-stacked" id="application_menu_list_container">
          <AdminMenu 
            userRoleCode={userLoginDetails?.userRoleCode}
            physicianAdminFlag={userLoginDetails?.physicianAdminFlag}
            clinicianAdminFlag={userLoginDetails?.clinicianAdminFlag}
          />
        </ul>
        <ul className="sidebar-nav m-0" id="application_menu_settings_container">
          <li className="application-menu-list">
            <a href="#" className="parent-link user-details-link" onClick={(e) => e.preventDefault()}>
              <span className="app-menu-icon user-profile-icon">
                <img className="profile-image user-profile" src={doctorImage} alt="Doctor Profile" />
              </span> 
              <ul className="user-details-list">
                <li className="user-desc">
                  <span className="app-menu-description ms-0 user-name text-truncate text-capitalize">
                    {userFullName || "Staff User"} <b>({userLoginDetails?.userTimeZone || "EST"})</b>
                  </span> 
                  <span className="app-menu-description ms-0 user-role text-truncate">{userLoginDetails?.userRoleDesc || "Admin"}</span>
                </li>
                <li className="user-profile-icons">
                  <span className="app-menu-icon me-0 mdi mdi-cog-outline" data-bs-toggle="tooltip" data-bs-placement="top" title="Settings"></span>
                  <span className="app-menu-icon me-0 mdi mdi-logout" data-bs-toggle="tooltip" data-bs-placement="top" title="Logout"></span>
                </li>
              </ul>
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;