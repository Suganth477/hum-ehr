import { useCallback, useEffect, useState } from 'react';
import { deletePatientHospitalization, fetchPatientHospitalizations } from '../../../services/hospitalizationService';
import { SkeletonList } from '../../../components/common/ContentLoader';
import { useNotify } from '../../../context/NotificationContext';
import { HospitalIcon, LegacyIcon } from '../../../components/common/CustomIcons';
import DeletedRecordBadge from '../../../components/common/DeletedRecordBadge';

// Legacy getHospitalizationIcon / getHospitalizationActiveIcon.
const HospitalizationIcon = ({ active }) => (active ? (<div className="p-2 rounded-circle hospitalization-record-icon active">
    <span className="p-2 pt-3 default-background"><HospitalIcon/></span>
    <div className="active-indicator"><span className="active-indicator-text">Active</span></div>
  </div>) : (<div className="p-2 rounded-circle hospitalization-record-icon">
    <span className="p-2 pt-3 default-background"><HospitalIcon/></span>
  </div>));

const PatientHospitalizationList = ({ patientId, searchTerm, onSearchChange, showDeleted, onShowDeletedChange, refreshKey, onAdd, onEdit, }) => {
    const [records, setRecords] = useState(null); // null = fetching (skeleton)
    const { notifyError, notifySuccess } = useNotify();

    const loadList = useCallback(async (search) => {
        setRecords(null);
        try {
            const result = await fetchPatientHospitalizations({ patientId, search });
            setRecords(Array.isArray(result.records) ? result.records : []);
        }
        catch (error) {
            console.error('Failed to get hospitalization list.', error);
            setRecords([]);
            notifyError(error?.message || 'Failed to get hospitalization list.');
        }
    }, [patientId, notifyError]);

    // Legacy debounces the hospital-name search (1s); mirror with a short delay.
    useEffect(() => {
        const term = (searchTerm || '').trim();
        const timer = window.setTimeout(() => { loadList(term); }, 400);
        return () => window.clearTimeout(timer);
    }, [searchTerm, refreshKey, loadList]);

    const handleDelete = async (record) => {
        if (!window.confirm('Are you sure about deleting the hospitalization record?'))
            return;
        try {
            const response = await deletePatientHospitalization({ patientId, id: record.id });
            if (!response || response.status === 'success') {
                notifySuccess('Hospitalization record marked as error successfully.');
                loadList((searchTerm || '').trim());
            }
            else {
                notifyError(response.message || 'Failed to delete hospitalization record.');
            }
        }
        catch (error) {
            console.error('Failed to delete hospitalization record.', error);
            notifyError(error?.message || 'Failed to delete hospitalization record.');
        }
    };

    // Legacy toggles between active-only (invalidFlag 'N') and marked-as-error-only ('Y').
    const displayed = (records || []).filter((record) => (showDeleted ? record.invalidFlag === 'Y' : record.invalidFlag === 'N'));

    return (<div className="pc-patient-chart-hospitalization-list-element-wrapper">
      <div className="row m-0 p-0 pt-2">
        <div className="col-md-3">
          <div className="label fw-bold">
            <div className="label-svg-heading" style={{ fontSize: '1rem' }}>Hospitalization History</div>
          </div>
        </div>
        <div className="col-md-9">
          <div className="d-flex gap-0 justify-content-end flex-wrap">
            <div className="pc-patient-hospitalization-search-wrapper patient-chart-search-input-icon-container px-1 position-relative">
              <input type="text" id={`pc_patient_chart_hospitalization_search_${patientId}`} name="pc_patient_chart_hospitalization_search" className="form-control text-capitalize" placeholder="Search Hospital Name" value={searchTerm} onChange={(event) => onSearchChange(event.target.value)}/>
              <LegacyIcon icon="fa-magnifying-glass" className="input-icon"/>
            </div>
            <div className="pc-patient-hospitalization-view-marked-as-error px-1 d-flex align-items-center">
              <label htmlFor={`pc_patient_chart_hospitalization_view_${patientId}`} className="mb-0">
                <input type="checkbox" className="form-checkbox" id={`pc_patient_chart_hospitalization_view_${patientId}`} name="pc_patient_chart_hospitalization_view" checked={showDeleted} onChange={(event) => onShowDeletedChange(event.target.checked)}/>
                &nbsp;Show Deleted Records
              </label>
            </div>
            <div className="pc-patient-hospitalization-add px-1">
              <button type="button" id={`pc_patient_chart_hospitalization_add_${patientId}`} className="btn btn-primary border-radius-button" onClick={onAdd}>
                <LegacyIcon icon="mdi-plus"/>
                <span>Add Hospitalization Detail</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="row m-0 p-0">
        <div className="pc-patient-hospitalization-list-wrapper custom-scrollbar">
          {records === null ? (<SkeletonList rows={4}/>) : displayed.length > 0 ? (<div className="timeline-hosp">
              {displayed.map((record) => {
                const isMarkedAsError = record.invalidFlag === 'Y';
                const isActive = !record.lastEffectiveDate && !isMarkedAsError;
                return (<div key={record.id} className={`pc-patient-chart-hospitalization-record px-2 pb-1 ${isActive ? 'active' : ''} ${isMarkedAsError ? 'marked-as-error' : ''}`}>
                    <span className="timeline-hosp-indicator"/>
                    <div className="pc-patient-hospitalization-record-wrapper ps-3">
                      <div className="d-flex gap-0 py-2 hospital-border">
                        <div className="w-8 pc-hospitalization-icon"><HospitalizationIcon active={isActive}/></div>
                        <div className="w-92 pc-hospitalization-record-detail-section">
                          <div className="row m-0 p-0">
                            <div className="col-md-4">
                              <div className="pch-hospital-name pch-hospital-detail">
                                <label className="pch-hospital-label">Hospital Name : </label>
                                {record.hospitalName}
                              </div>
                              <div className="pch-hospital-admitted-period pch-hospital-sub-detail">
                                {record.lastEffectiveDate ? (<>{record.effectiveDate} <LegacyIcon icon="fa-arrow-right" className="px-1"/> {record.lastEffectiveDate}</>) : record.effectiveDate}
                              </div>
                              {isMarkedAsError && <DeletedRecordBadge />}
                            </div>
                            <div className="col-md-4">
                              <label className="pch-hospital-label">Admitted Diagnosis</label>
                              {record.diagnosisList && record.diagnosisList.length > 0 ? record.diagnosisList.map((diagnosis, index) => (<div key={index} className="pch-hospital-diagnosis pch-hospital-detail">{index + 1}) {diagnosis.icdCode} {diagnosis.longDescription || diagnosis.snomedCode}</div>)) : (<div className="pch-hospital-diagnosis pch-hospital-detail">-</div>)}
                            </div>
                            <div className="col-md-3">
                              <label className="pch-hospital-label">Discharge Disposition</label>
                              <div className="pch-hospital-detail-sub">
                                {record.dischargeDisposition ? (record.dischargeDispositionCode !== 'OTH' ? record.dischargeDisposition : record.dischargeDispositionOther) : ''}
                              </div>
                            </div>
                            <div className={`col-md-1 ${isMarkedAsError ? 'd-none' : ''}`}>
                              <div className="action-icon-dropdown-group ehr-hospitalization-action-items">
                                <LegacyIcon icon="mdi-dots-vertical" className="action-group-icon" data-bs-toggle="dropdown" data-bs-auto-close="true" aria-expanded="false"/>
                                <ul className="dropdown-menu action-icon-dropdown-menu-list hospitalization-list-action-items">
                                  <li><div className="ehr-patient-hospitalization-list-edit-icon" onClick={() => onEdit(record)}><span><LegacyIcon icon="fa-pen" className="action-icon"/></span> Edit</div></li>
                                  <li><div className="ehr-patient-hospitalization-list-delete-icon" onClick={() => handleDelete(record)}><span><LegacyIcon icon="fa-trash" className="action-icon"/></span>Delete</div></li>
                                </ul>
                              </div>
                            </div>
                          </div>
                          <div className="row m-0 p-0">
                            <label className="notes-label">Notes</label>
                            <div className="pch-hospital-detail-sub">
                              {record.careNotes ? record.careNotes : '-'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>);
              })}
            </div>) : (<div className="list-wrapper mt-2" style={{ border: '2px solid #ddd', padding: '30px 20px', textAlign: 'center' }}>
              <div className="nodata"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 40, verticalAlign: 'sub' }}/>
                <span style={{ fontSize: 20 }}> Patient doesn't any Hospitalization Record. </span>
              </div>
            </div>)}
        </div>
      </div>
    </div>);
};
export default PatientHospitalizationList;
