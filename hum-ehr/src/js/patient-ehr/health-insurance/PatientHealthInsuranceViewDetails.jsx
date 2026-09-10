import { useState } from 'react';
import { deletePatientHealthInsurance } from '../../../services/healthInsuranceService';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import DetailField from '../../../components/common/DetailField';

const formatUsAddress = (line1, line2, city, state, zip) =>
    [line1, line2, city, state, zip].map((part) => (part || '').toString().trim()).filter(Boolean).join(', ') || '-';

const Field = ({ label, value }) => (<DetailField col="col-md-3" label={label} value={value}/>);

const PatientHealthInsuranceViewDetails = ({ patientId, record, recordType, isMedicarePatient, onEdit, onDeleted }) => {
    const [showMore, setShowMore] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const { notifyError, notifySuccess } = useNotify();

    if (!record)
        return (<div className="list-wrapper my-5" style={{ padding: '30px 20px', textAlign: 'center' }}>
          <div className="nodata"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/>
            <span style={{ fontSize: 20 }}> Patient doesn't have any {recordType === 'active' ? 'active ' : ''}health insurance yet!</span>
          </div>
        </div>);

    const isSelf = record.relationShipTypeCode === 'SELF';
    const subscriberType = record.relationShipTypeCode === 'OTH'
        ? `${record.relationShipTypeDesc}-${record.otherRelationShip}`
        : record.relationShipTypeDesc;
    const subscriberAddress = formatUsAddress(record.subscriberAddressLineOne, record.subscriberAddressLineTwo, record.subscriberCity, record.subscriberState, record.subscriberZipCode);
    const memberAddress = formatUsAddress(record.memberAddressLineOne, record.memberAddressLineTwo, record.memberCity, record.memberState, record.memberZipCode);
    const showActions = recordType !== 'history';
    // Delete locks: EMR-sourced records, and Medicare primary for AWV billing.
    const emrLocked = record.sourceType === 'CPLNEMR';
    const medicareLocked = isMedicarePatient === 'Y' && record.payerTypeCode === '1';
    const deleteDisabled = deleting || emrLocked || medicareLocked;

    const handleDelete = async () => {
        if (!window.confirm('Are you sure about deleting the health insurance?'))
            return;
        setDeleting(true);
        try {
            const response = await deletePatientHealthInsurance({ id: record.id, patientId });
            if (!response || response.status === 'success') {
                notifySuccess('Patient health insurance record deleted successfully.');
                onDeleted();
            }
            else {
                notifyError(response.message || 'Failed to delete the record. Please try again.');
            }
        }
        catch (error) {
            console.error('Failed to delete the record.', error);
            notifyError(error?.message || 'Failed to delete the record. Please try again.');
        }
        finally {
            setDeleting(false);
        }
    };

    return (<div className="show-details-main-container mb-3">
      <div className="row mx-3 my-4 mb-0">
        <div className="col-md-11 fw-bold patient-chart-list-selected-item-title text-capitalize">{record.payerName || 'Health Insurance'}</div>
        {showActions && (<div className="col-md-1 d-flex gap-2">
            <span className={`icon-container ${emrLocked ? 'disabled' : ''}`} title={emrLocked ? 'Disabled due to EMR Entry' : 'Edit Health Insurance'}>
              <LegacyIcon icon="mdi-pencil" className="health-insurance-edit-icon" role="button" onClick={emrLocked ? undefined : () => onEdit(record)}/>
            </span>
            <span className={`icon-container delete-icon-container ${deleteDisabled ? 'disabled' : ''}`} title={emrLocked ? 'Disabled due to EMR Entry' : medicareLocked ? 'Medicare insurance type cannot be deleted for AWV medicare billing' : 'Delete Health Insurance'}>
              <LegacyIcon icon="mdi-delete" className="health-insurance-delete-icon" role="button" onClick={deleteDisabled ? undefined : handleDelete}/>
            </span>
          </div>)}
      </div>

      {/* less details */}
      {!showMore && (<div className="row less-health-insurance-details-container">
          <div className="col-md-12">
            <div className="row mx-3 my-4">
              <Field label="Insurance Provider" value={record.payerName}/>
              <Field label="Policy Number" value={record.policyNumber}/>
              <Field label="Effective Date" value={record.effectiveDate}/>
            </div>
            <div className="row mx-3 my-4">
              <Field label="Subscriber Name" value={record.subscriberFullName}/>
              <Field label="Subscriber Type" value={subscriberType}/>
              <Field label="Subscriber Number" value={record.subscriberNumber}/>
            </div>
            <div className="row mx-3 my-4">
              <Field label="Member Name" value={record.memberFullName}/>
              <Field label="Member Number" value={record.memberNumber}/>
            </div>
          </div>
        </div>)}

      {/* more details */}
      {showMore && (<div className="row more-health-insurance-details-container">
          <div className="col-md-12">
            <div className="health-insurance-type-heading">Insurance</div>
            <div className="row mx-3 my-4">
              <Field label="Coverage Priority" value={record.insuranceTypeDesc}/>
              <Field label="Insurance Provider" value={record.payerName}/>
              <Field label="Policy Number" value={record.policyNumber}/>
              <Field label="Group Number" value={record.groupNumber}/>
            </div>
            <div className="row mx-3 my-4">
              <Field label="Group Name" value={record.groupName}/>
              <Field label="Effective Date" value={record.effectiveDate}/>
              <Field label="Last Effective Date" value={record.lastEffectiveDate}/>
              <Field label="Insurance Status" value={record.insuranceStatus}/>
            </div>
            <div className="row mx-3 my-3">
              <Field label="Qualified Medicare Beneficiary" value={record.qualifiedMedicareBeneficiaryFlag === 'Y' ? 'Yes' : 'No'}/>
            </div>
            <hr />
            <div className="health-insurance-type-heading">Subscriber</div>
            <div className="row mx-3 my-4">
              <Field label="Subscriber Type" value={subscriberType}/>
              <Field label="Subscriber Number" value={record.subscriberNumber}/>
              <Field label="Phone Number" value={record.subscriberPhoneNumber}/>
              <Field label="Subscriber Name" value={record.subscriberFullName}/>
            </div>
            <div className="row mx-3 my-4">
              <Field label="Date of Birth" value={record.subscriberDOB}/>
              <Field label="Address" value={subscriberAddress}/>
              <Field label="Country" value={record.subscriberCountry || 'USA'}/>
            </div>
            <hr />
            <div className="health-insurance-type-heading">Member</div>
            {isSelf ? (<div className="nodata d-flex justify-content-center align-items-center mb-2">
                <div className="me-2"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/></div>
                <div style={{ fontSize: 18 }}>If the patient is a subscriber, member details are not required.</div>
              </div>) : (<>
                <div className="row mx-3 my-4">
                  <Field label="Member Name" value={record.memberFullName}/>
                  <Field label="Member Number" value={record.memberNumber}/>
                  <Field label="Date Of Birth" value={record.memberDOB}/>
                  <Field label="Phone Number" value={record.memberPhoneNumber}/>
                </div>
                <div className="row mx-3 my-4">
                  <Field label="Address" value={memberAddress}/>
                  <Field label="Country" value={record.memberCountry || '-'}/>
                </div>
              </>)}
          </div>
        </div>)}

      <div className="show-less-more-details-btn ms-4 ps-1" role="button" onClick={() => setShowMore((value) => !value)}>
        {showMore ? 'view less details...' : 'view more details...'}
      </div>
    </div>);
};
export default PatientHealthInsuranceViewDetails;
