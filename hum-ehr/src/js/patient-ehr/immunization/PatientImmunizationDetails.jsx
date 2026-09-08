import { useState } from 'react';
import { buildImmunizationDeletePayload, deleteImmunization } from '../../../services/immunizationService';
import { getFormattedIcdCode } from '../../../utils/commonUtility';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';

// Labelled value cell. `cap` capitalizes, `strike` applies the marked-as-error styling.
const Field = ({ label, value, className = 'col-md-3', cap, strike, children }) => (
    <div className={className}>
      <div className="label">{label}</div>
      <div className={`fw-bold vaccine-delete-record-common-class ${cap ? 'text-capitalize' : ''} ${strike ? 'error-in' : ''}`}>{children ?? (value || '-')}</div>
    </div>
);

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
          {isDeleted && <span className="ehr-deleted-records ms-2">Deleted Record</span>}
        </div>
        <div className="col-md-1 d-flex gap-2 immunization-action-container justify-content-end">
          <LegacyIcon icon="mdi-pencil" className="vaccine-edit-device-icon" role="button" title="Edit Vaccine" onClick={() => onEdit(record)}/>
          {!isDeleted && <LegacyIcon icon="mdi-delete" className={`vaccine-delete-device-icon ${deleting ? 'disabled' : ''}`} role="button" title="Delete Vaccine" onClick={deleting ? undefined : handleDelete}/>}
        </div>
      </div>

      <div className="immunization-vaccine-details-container custom-scrollbar">
        <div className="row mx-3 my-4">
          <Field label="Vaccine" value={record.vaccineName} cap strike={isDeleted}/>
          <Field label="Status" value={record.vaccineStatusCodeDesc} strike={isDeleted}/>
          <Field label="Status Reason" value={record.vaccineStatusReasonDesc} strike={isDeleted}/>
          <Field label="Recorded By" value={record.recordedUserName} cap strike={isDeleted}/>
        </div>

        <div className="row mx-3 my-4">
          <Field label="Recorded Date &amp; Time" value={record.recordedDate} cap strike={isDeleted}/>
          <Field label="Administered on Date &amp; Time" value={record.administeredDate} strike={isDeleted}/>
          <Field label="Administered By" value={record.administeredBy} cap strike={isDeleted}/>
          <Field label="Where the Vaccine was Administered / Location" value={record.vaccineAdministeredLocation} strike={isDeleted}/>
        </div>

        {!notDone && (<div className="row mx-3 my-4 vaccine-status-reason-hide-container">
          <Field label="Route of Administration" value={record.route} cap strike={isDeleted}/>
          <Field label="Body Site" value={record.site} cap strike={isDeleted}/>
        </div>)}

        <div className="row mx-3 my-4">
          <Field label="Dose Number" value={record.doseNumber} cap strike={isDeleted}/>
          <Field label="Dose Form" value={record.doseForm} cap strike={isDeleted}/>
          <Field label="Dose &amp; Unit" value={record.doseWithUnit} strike={isDeleted}/>
        </div>

        {!notDone && (<div className="row mx-3 my-4 vaccine-status-reason-hide-container">
          <Field label="Lot Number" value={record.lotNumber} strike={isDeleted}/>
          <Field label="Name Of Manufacturer" value={record.manufacturerName} cap strike={isDeleted}/>
        </div>)}

        <div className="row mx-3 my-4">
          <Field className="col-md-12" label="Targeted Indication/Diagnosis" cap strike={isDeleted}>
            {targetedDiagnosis.length
              ? targetedDiagnosis.map((d, i) => (<div key={i} className="targeted-diagnosis-item mt-2">{getFormattedIcdCode(d.icdCode)} - {d.icdDescription}</div>))
              : '-'}
          </Field>
        </div>

        {!notDone && (<div className="row mx-3 my-4 vaccine-status-reason-hide-container">
          <Field label="Date Printed On VIS" value={record.visPrintedDate} cap strike={isDeleted}/>
          <Field label="Date VIS Given to Patient /Parent / Guardian" value={record.visGivenToPatientDate} strike={isDeleted}/>
          <Field label="Expiration Date &amp; Time" value={record.expirationDate} strike={isDeleted}/>
        </div>)}

        <div className="row mx-3 my-4">
          <Field label="Program Eligibility" value={record.programEligibilityDesc} cap strike={isDeleted}/>
          <Field label="Funding Source" value={record.fundingSourceDesc} strike={isDeleted}/>
        </div>

        <div className="row mx-3 my-4">
          <Field label="Vaccination Reason" value={record.vaccineReason} strike={isDeleted}/>
        </div>

        <div className="row mx-3 my-4">
          <Field className="col-md-12" label="Notes" value={record.notes} strike={isDeleted}/>
        </div>
      </div>
    </div>);
};
export default PatientImmunizationDetails;
