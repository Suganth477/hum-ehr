import React from 'react'

const NoDataAvailable = ({desc}) => {
  return (
    <div className="list-wrapper" style={{ border: '2px solid #ddd', padding: '30px 20px', textAlign: 'center' }}>
        <div className="nodata">
        <i className="mdi mdi-information-outline me-sm" style={{ fontSize: 30, verticalAlign: 'sub' }}/>
        <span style={{ fontSize: 20 }}>{desc}</span>
        </div>
    </div>
  )
}

export default NoDataAvailable
