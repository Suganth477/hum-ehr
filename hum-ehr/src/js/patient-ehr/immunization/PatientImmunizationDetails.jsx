import { useState } from 'react';
import { buildImmunizationDeletePayload, deleteImmunization } from '../../../services/immunizationService';
import { getFormattedIcdCode } from '../../../utils/commonUtility';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import DetailField from '../../../components/common/DetailField';
import DeletedRecordBadge from '../../../components/common/DeletedRecordBadge';
import RecordActionIcons from '../../../components/common/RecordActionIcons';

const PatientImmunizationDetails = ({ patientId, recordType, record, onEdit, onDeleted }) => {
    const [deleting, setDeleting] = useState(false);
    const { notifyError, notifySuccess } = useNotify();

    if (!record)
        return (<div className="list-wrapper my-5" style={{ padding: '30px 20px', textAlign: 'center' }}>
          <div className="nodata"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/>
            <span style={{ fontSize: 20 }}> Patient doesn't have any {recordType === 'active' ? 'active' : 'scheduled'} immunization yet!</span>
          </div>
        </div>);

    const isDeleted = record.invalidFlag === 'Y';
    // Legacy hides the administration-specific rows when the vaccine was not administered.
    const notDone = record.vaccineStatusCode === 'not-done';
    // Legacy renders targetedDiagnosis as "<icd> - <description>" per row.
    const targetedDiagnosis = Array.isArray(record.targetedDiagnosis) ? record.targetedDiagnosis : [];

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
      <div className="row mx-3 my-4 mb-4 immunizatin-vaccine-details-header">
        <div className="col-md-11 vaccine-name fw-bold patient-chart-list-selected-item-title text-capitalize">
          {record.vaccineName || '-'}
          {isDeleted && <DeletedRecordBadge inline/>}
        </div>
        <div className="col-md-1 immunization-action-container">
          <RecordActionIcons recordType={recordType} isDeleted={isDeleted} moduleTitle="Vaccine" onEdit={() => onEdit(record)} onDelete={handleDelete} editClass="vaccine-edit-device-icon" deleteClass="vaccine-delete-device-icon" busy={deleting}/>
        </div>
      </div>

      <div className="immunization-vaccine-details-container custom-scrollbar">
        <div className="row mx-3 my-4">
          <DetailField label="Vaccine" value={record.vaccineName} strike={isDeleted}/>
          <DetailField label="Status" value={record.vaccineStatusCodeDesc} cap={false} strike={isDeleted}/>
          <DetailField label="Status Reason" value={record.vaccineStatusReasonDesc} cap={false} strike={isDeleted}/>
          <DetailField label="Recorded By" value={record.recordedUserName} strike={isDeleted}/>
        </div>

        <div className="row mx-3 my-4">
          <DetailField label="Recorded Date &amp; Time" value={record.recordedDate} strike={isDeleted}/>
          <DetailField label="Administered on Date &amp; Time" value={record.administeredDate} cap={false} strike={isDeleted}/>
          <DetailField label="Administered By" value={record.administeredBy} strike={isDeleted}/>
          <DetailField label="Where the Vaccine was Administered / Location" value={record.vaccineAdministeredLocation} cap={false} strike={isDeleted}/>
        </div>

        {!notDone && (<div className="row mx-3 my-4 vaccine-status-reason-hide-container">
          <DetailField label="Route of Administration" value={record.route} strike={isDeleted}/>
          <DetailField label="Body Site" value={record.site} strike={isDeleted}/>
        </div>)}

        <div className="row mx-3 my-4">
          <DetailField label="Dose Number" value={record.doseNumber} strike={isDeleted}/>
          <DetailField label="Dose Form" value={record.doseForm} strike={isDeleted}/>
          <DetailField label="Dose &amp; Unit" value={record.doseWithUnit} cap={false} strike={isDeleted}/>
        </div>

        {!notDone && (<div className="row mx-3 my-4 vaccine-status-reason-hide-container">
          <DetailField label="Lot Number" value={record.lotNumber} cap={false} strike={isDeleted}/>
          <DetailField label="Name Of Manufacturer" value={record.manufacturerName} strike={isDeleted}/>
        </div>)}

        <div className="row mx-3 my-4">
          <DetailField col="col-md-12" label="Targeted Indication/Diagnosis" strike={isDeleted}>
            {targetedDiagnosis.length
              ? targetedDiagnosis.map((d, i) => (<div key={i} className="targeted-diagnosis-item mt-2">{getFormattedIcdCode(d.icdCode)} - {d.icdDescription}</div>))
              : '-'}
          </DetailField>
        </div>

        {!notDone && (<div className="row mx-3 my-4 vaccine-status-reason-hide-container">
          <DetailField label="Date Printed On VIS" value={record.visPrintedDate} strike={isDeleted}/>
          <DetailField label="Date VIS Given to Patient /Parent / Guardian" value={record.visGivenToPatientDate} cap={false} strike={isDeleted}/>
          <DetailField label="Expiration Date &amp; Time" value={record.expirationDate} cap={false} strike={isDeleted}/>
        </div>)}

        <div className="row mx-3 my-4">
          <DetailField label="Program Eligibility" value={record.programEligibilityDesc} strike={isDeleted}/>
          <DetailField label="Funding Source" value={record.fundingSourceDesc} cap={false} strike={isDeleted}/>
        </div>

        <div className="row mx-3 my-4">
          <DetailField label="Vaccination Reason" value={record.vaccineReason} cap={false} strike={isDeleted}/>
        </div>

        <div className="row mx-3 my-4">
          <DetailField col="col-md-12" label="Notes" value={record.notes} cap={false} strike={isDeleted}/>
        </div>
      </div>
    </div>);
};
export default PatientImmunizationDetails;
