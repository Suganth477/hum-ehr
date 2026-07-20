import React from 'react'
import { LegacyIcon } from './common/CustomIcons';

const NoDataAvailable = ({desc}) => {
  return (
    <div className="list-wrapper" style={{ border: '2px solid #ddd', padding: '30px 20px', textAlign: 'center' }}>
        <div className="nodata">
        <LegacyIcon icon="mdi-information-outline" className="me-sm" style={{ fontSize: 30, verticalAlign: 'sub' }}/>
        <span style={{ fontSize: 20 }}>{desc}</span>
        </div>
    </div>
  )
}

export default NoDataAvailable
