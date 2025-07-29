// useUtilities.js
import { useState, useEffect, useCallback } from 'react';
import moment from 'moment-timezone';
import { Toast } from 'bootstrap/dist/js/bootstrap.bundle.min';
import axios from 'axios';
import Cookies from "js-cookie"

import env from "../../env"
const useUtilities = () => {
  // State for storing data that might change
  const [careGroupPhysicians, setCareGroupPhysicians] = useState({});
  const [loggedInUserDetails, setLoggedInUserDetails] = useState({});
  const [careGroupSubscribedProducts, setCareGroupSubscribedProducts] = useState([]);
  const baseUrl = env.BASE_URL;
  const token = Cookies.get('X-Auth-Token');

  // Constants
  const dateTimeFormats = {
    DD: "DD",
    YMD_24H: "YYYY-MM-DD HH:mm:ss",
    MDY_24H: "MM-DD-YYYY HH:mm:ss",
    MDY_12H: "MM-DD-YYYY hh:mm A",
    YMD_12H: "YYYY-MM-DD hh:mm A",
    MDY: "MM-DD-YYYY",
    YMD: "YYYY-MM-DD",
    _24H: "HH:mm:ss",
    _12H: "hh:mm A",
    MM_YY: "MMMM YYYY",
    MDYHMS: 'MDYHHmmss',
    MMSDDYYYYHHMMSS: 'MMDDYYYYhhmmss',
    MYSQL_YMD_24H: "YYYY-MM-DD HH:mm:ss",
    MYSQL_YMD_12H: "YYYY-MM-DD hh:mm:ss",
  };

  // Helper functions
  const getTimeZoneCode = useCallback((timeZoneCode) => {
    switch (timeZoneCode) {
      case "EST":
      case "US/Eastern":
        return "US/Eastern";
      case "CST":
      case "US/Central":
        return "US/Central";
      case "MST":
      case "US/Mountain":
        return "US/Mountain";
      case "PST":
      case "US/Pacific":
        return "US/Pacific";
      case "AZ":
      case "US/Arizona":
        return "US/Arizona";
      case "AKST":
      case "US/Alaska":
        return "US/Alaska";
      case "HST":
      case "US/Hawaii":
        return "US/Hawaii";
      default:
        return "US/Eastern";
    }
  }, []);

  const getTimeZoneShortCode = useCallback((timeZoneCodeDescription) => {
    switch (timeZoneCodeDescription) {
      case "US/Eastern":
        return "EST";
      case "US/Central":
        return "CST";
      case "US/Mountain":
        return "MST";
      case "US/Pacific":
        return "PST";
      case "US/Arizona":
        return "AZ";
      case "US/Alaska":
        return "AKST";
      case "US/Hawaii":
        return "HST";
      default:
        return "EST";
    }
  }, []);

  const zeroPadding = useCallback((number) => {
    return parseInt(number) > 9 ? number : '0' + number;
  }, []);

  const getUserTimeZone = useCallback(() => {
    // This would come from your auth context or similar
    return parseJwt()?.timezone || 'US/Eastern';
  }, []);

  // Notification functions
  const successMessage = useCallback((message) => {
    Toast.success(message);
  }, []);

  const failureMessage = useCallback((message) => {
    Toast.error(message);
  }, []);

  const alertMessage = useCallback((message) => {
    Toast.warn(message);
  }, []);

  // Cookie and JWT functions
  const getCookieValue = useCallback((name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }, []);

  const parseJwt = useCallback(() => {
    const token = getCookieValue("X-Auth-Token");
    if (token) {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(window.atob(base64));
    } else {
      window.location.href = `${window.location.origin}/logout`;
      return null;
    }
  }, [getCookieValue]);

  // Data fetching functions
  const getListOfSubscribedProducts = useCallback((allProduct = "Y") => {
    if (careGroupSubscribedProducts.length > 0) {
      return Promise.resolve(careGroupSubscribedProducts); // Return cached data
    }

    return axios
      .post(`${baseUrl}/configuration/products`, { allProduct }, {headers: {'x-auth-token':token}})
      .then((response) => {
        if (response.data.status === 'success') {
          setCareGroupSubscribedProducts(response.data.data || []);
          return response.data.data;
        }
        return [];
      })
      .catch((error) => {
        failureMessage("Failed to fetch subscribed products. Please try again.");
        return [];
      });
  }, [careGroupSubscribedProducts, failureMessage]);

  const getListOfFacilities = useCallback ((physicianId = '', clinicianId = '', patientId = '', careGroupId = '') => {
      return axios.post(`${baseUrl}/facilities`, {physicianId, clinicianId, patientId, careGroupId},
      {headers: {'x-auth-token':token}})
    .then(response => {
      if (response.data.status === "success") {
        return response.data.data || {};
      }
      return {};
    }).catch(error => {
      failureMessage("Failed to load the facilities. Please try again.");
      return {};
    });
  }, []);

  const getListOfClinicians = useCallback ((facilityId = '', careGroupId = '') => {
    return axios.post(`${baseUrl}/clinicians`, {facilityId, careGroupId}, {headers: {'x-auth-token':token}})
    .then(response => {
      if (response.data.status === "success") {
        return response.data.data || {};
      }
      return {};
    }).catch(error => {
      failureMessage("Failed to load the clinicians. Please try again.");
      return {};
    });
  }, []);


  const getLoginUserDetails = useCallback(() => {
    // Check if we already have the required details
    if (loggedInUserDetails.clinicianId && loggedInUserDetails.physicianId) {
      return Promise.resolve(loggedInUserDetails);
    }

    setLoading(true);
    return axios.get(`${baseUrl}/service-time-tracker/log-in-detail`, {headers: {'x-auth-token':token}})
      .then(response => {
        if (response.data.status === "success") {
          const userDetails = response.data.data || {};
          setLoggedInUserDetails(userDetails);
          return userDetails;
        }
        return {};
      })
      .catch(error => {
        Toast.error("Failed to get login details. Please try again.");
        return {};
      })
      .finally(() => {
        setLoading(false);
      });
  }, [loggedInUserDetails]);


  const getListOfPhysiciansInCareGroup = useCallback(() => {
  if (Object.keys(careGroupPhysicians).length > 0) {
    return Promise.resolve(careGroupPhysicians); // Return cached data as a resolved Promise
  }

  return axios.get(`${baseUrl}/physicians`, {headers: {'x-auth-token':token}})
    .then(response => {
      if (response.data.status === "success") {
        const physiciansData = response.data.data || {};
        setCareGroupPhysicians(physiciansData);
        return physiciansData;
      }
      return {};
    })
    .catch(error => {
      failureMessage("Failed to load the physicians. Please try again.");
      return {};
    });
}, [careGroupPhysicians, failureMessage]);

  // Date/Time utilities
  const currentDateTimeForTimeZone12H = useCallback((timezone) => {
    const timeZoneCode = getTimeZoneCode(timezone);
    return moment().tz(timeZoneCode).format(dateTimeFormats.MDY_12H);
  }, [getTimeZoneCode]);

  const convertSecondsIntoTimeHMS = useCallback((timeInSeconds) => {
    if (!timeInSeconds) return null;
    const hours = zeroPadding(parseInt(timeInSeconds / 3600));
    const minutes = zeroPadding(parseInt(timeInSeconds % 3600 / 60));
    const seconds = zeroPadding(parseInt(timeInSeconds % 3600 % 60));
    return `${hours}:${minutes}:${seconds}`;
  }, [zeroPadding]);

  // Patient related utilities
  const displayPatientCareStatusIcon = useCallback((patientCareStatusCode) => {
    switch (patientCareStatusCode) {
      case "HCARE":
        return {
          title: "(Home Care)", 
          description: "<span class='home-care'>(Home Care)</span>", 
          icon: `<svg class="patient-enrollment-status-indicator active-patient-indicator home-care" viewBox="0 0 2800 2800">...</svg>`
        };
      case "HOSP":
        return {
          title: "(Hospitalized)", 
          description: "<span class='hospitalization'>(Hospitalized)</span>", 
          icon: `<svg class="patient-enrollment-status-indicator active-patient-indicator hospitalization" viewBox="0 0 24 24">...</svg>`
        };
      case "STATINCO":
        return {
          title: "", 
          description: "", 
          icon: `<svg class="patient-enrollment-status-indicator incomplete-patient-indicator" viewBox="0 0 24 24">...</svg>`
        };
      default:
        return {
          title: "", 
          description: "", 
          icon: `<svg class="patient-enrollment-status-indicator active-patient-indicator" viewBox="0 0 24 24">...</svg>`
        };
    }
  }, []);

  const getTextMessageSendStatus = useCallback((patientDetails) => {
    const { phoneNumberStatus, careGroupTextConfig, disableFacilityTextConfig, textMsgPhoneNumber } = patientDetails;
    return phoneNumberStatus === "PTVALID" && careGroupTextConfig === "Y" &&
      disableFacilityTextConfig === "N" && textMsgPhoneNumber && textMsgPhoneNumber.length >= 10;
  }, []);

  // Other utilities
  const makeUpperCaseOfEachString = useCallback((string) => {
    if (string) {
      let splitStr = string.toLowerCase().split(' ');
      for (let i = 0; i < splitStr.length; i++) {
        splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
      }
      return splitStr.join(' ');
    }
    return "";
  }, []);

  const convertToHTMLEntity = useCallback((string) => {
    return string.replace(/&/g, "&amp;")
      .replace(/>/g, "&gt;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }, []);

  const ageCalculator = useCallback((dob) => {
    try {
      return moment().diff(moment(dob, dateTimeFormats.MDY), "years");
    } catch (e) {
      failureMessage("Failed to calculate the age.");
      return false;
    }
  }, [failureMessage]);

  const displayAddressInUSFormat = useCallback ((addressLineOne, addressLineTwo, city, state, zipcode) => {
        const [area, location] = [[], []];
        addressLineOne ? area.push(addressLineOne) : '';
        addressLineTwo ?  area.push(' ' + addressLineTwo + ',') : '';
        city ? location.push(city) : '';
        state ? location.push(' ' + state.toUpperCase()) : '';
        zipcode ? location.push(' ' + zipcode) : '';
        return area.toString() + (area.toString() ? '<br>' + location.toString() : location.toString());
    }, []);

  // Return all the utility functions
  return {
    // Helper functions
    getTimeZoneCode,
    getTimeZoneShortCode,
    zeroPadding,
    getUserTimeZone,
    
    // Notification functions
    successMessage,
    failureMessage,
    alertMessage,
    
    // Cookie and JWT functions
    getCookieValue,
    parseJwt,
    
    // Data fetching functions
    getListOfSubscribedProducts,
    getListOfPhysiciansInCareGroup,
    
    // Date/Time utilities
    currentDateTimeForTimeZone12H,
    convertSecondsIntoTimeHMS,
    
    // Patient related utilities
    displayPatientCareStatusIcon,
    getTextMessageSendStatus,
    
    // Other utilities
    makeUpperCaseOfEachString,
    convertToHTMLEntity,
    ageCalculator,
    getListOfFacilities,
    getListOfClinicians,
    getLoginUserDetails,
    displayAddressInUSFormat
    // Add more utilities as needed...
  };
};

export default useUtilities;  