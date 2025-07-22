import React from 'react'
import {useSelector} from "react-redux";


const ActivePatientsList3 =() => {
  const users = useSelector((state) => state.userInfo.user);
  console.log('Users:', users);
  
  return (
    <div>
      <h2>Users List</h2>
      </div>
  );
}
export default ActivePatientsList3;