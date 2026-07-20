import { useState } from 'react';
import { buildImmunizationDeletePayload, deleteImmunization } from '../../../services/immunizationService';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';

const PatientImmunizationDetails = ({ patientId, recordType, record, onEdit, onDeleted }) => {
    const [showMore, setShowMore] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const { notifyError, notifySuccess } = useNotify();

    if (!record)
        return (<div className="list-wrapper my-5" style={{ padding: '30px 20px', textAlign: 'center' }}>
          <div className="nodata"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/>
            <span style={{ fontSize: 20 }}> Patient doesn't have any {recordType === 'active' ? 'active' : 'scheduled'} immunization yet!</span>
          </div>
        </div>);

    const handleDelete = async () => {
        if (!window.confirm('Are you sure about deleting the immunization?'))
            return;
        setDeleting(true);
        try {
            const changeLogMessage = `An existing immunization "${record.vaccineName || ''}" has been deleted`;
            const response = await deleteImmunization(buildImmunizationDeletePayload({ record, patientId, changeLogMessage }));
            if (!response || response.status === 'success') {
                notifySuccess('Immunization record deleted successfully.');
                onDeleted();
            }
            else {
                notifyError(response.message || 'Failed to delete the immunization record.');
            }
        }
        catch (error) {
            console.error('Failed to delete immunization.', error);
            notifyError(error?.message || 'Failed to delete the immunization record.');
        }
        finally {
            setDeleting(false);
        }
    };

    return (<div className="immunization-vaccine-details-main-container show-details-main-container">
      <div className="row mx-3 my-4 mb-4">
        <div className="col-md-11 vaccine-name fw-bold patient-chart-list-selected-item-title text-capitalize">{record.vaccineName}</div>
        <div className="col-md-1 vaccine-action-icons d-flex gap-2">
          <LegacyIcon icon="mdi-pencil" className="vaccine-edit-device-icon" role="button" title="Edit Vaccine" onClick={() => onEdit(record)}/>
          <LegacyIcon icon="mdi-delete" className={`vaccine-delete-device-icon ${deleting ? 'disabled' : ''}`} role="button" title="Delete Vaccine" onClick={deleting ? undefined : handleDelete}/>
        </div>
      </div>

      <div className="row mx-3 my-4">
        <div className="col-md-3"><div className="label">Route of Administration</div><div className="fw-bold text-capitalize">{record.route || '-'}</div></div>
        <div className="col-md-3"><div className="label">Site</div><div className="fw-bold text-capitalize">{record.site || '-'}</div></div>
        <div className="col-md-3"><div className="label">Vaccination Reason</div><div className="fw-bold">{record.vaccineReason || '-'}</div></div>
        <div className="col-md-3"><div className="label">Vaccination administered on / will administer</div><div className="fw-bold">{record.administeredDate || '-'}</div></div>
      </div>
      <div className="row mx-3 my-4">
        <div className="col-md-12"><div className="label">Notes</div><div className="fw-bold">{record.notes || '-'}</div></div>
      </div>

      {showMore && (<div className="hide-show-vaccine-detail-container">
          <div className="row mx-3 my-4">
            <div className="col-md-3"><div className="label">Administered Physician</div><div className="fw-bold text-capitalize">{record.administeringPhysicianName || '-'}</div></div>
            <div className="col-md-3"><div className="label">Name Of Manufacturer</div><div className="fw-bold text-capitalize">{record.manufacturerName || '-'}</div></div>
            <div className="col-md-3"><div className="label">Lot Number</div><div className="fw-bold">{record.lotNumber || '-'}</div></div>
            <div className="col-md-3"><div className="label">Expiration Date &amp; Time</div><div className="fw-bold">{record.expirationDate || '-'}</div></div>
          </div>
          <div className="row mx-3 my-4">
            <div className="col-md-3"><div className="label">Dose Form</div><div className="fw-bold text-capitalize">{record.doseForm || '-'}</div></div>
            <div className="col-md-3"><div className="label">Dose &amp; Unit</div><div className="fw-bold">{record.doseWithUnit || '-'}</div></div>
          </div>
        </div>)}

      <div className="show-hide-view-btn ms-4 ps-1" role="button" onClick={() => setShowMore((v) => !v)}>
        {showMore ? 'view less details...' : 'view more details...'}
      </div>
    </div>);
};
export default PatientImmunizationDetails;
