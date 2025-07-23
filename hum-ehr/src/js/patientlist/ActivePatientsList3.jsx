import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchPatientDetails } from '../slices/userSlice';


const ActivePatientsList3 = () => {
  const dispatch = useDispatch();
  const users = useSelector((state) => state.userInfo.user);
  const patientDetails = useSelector((state) => state.userInfo.patientDetails);

  useEffect(() => {
    dispatch(fetchPatientDetails(32633)); // Replace 32633 with dynamic patientId if needed
  }, [dispatch]);

  console.log("Users:", users);
  console.log("Patient Details:", patientDetails);
  
  return (
    <div>
      <h2>Users List</h2>
    </div>
  );
};

export default ActivePatientsList3;