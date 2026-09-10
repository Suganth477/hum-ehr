import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildProblemDeletePayload, deletePatientProblem, fetchPatientProblems } from '../../../services/problemService';
import { checkItIsNewRecordOrEditRecord } from '../../../services/sessionLockService';
import { triggerPatientDsiRefresh } from '../../../services/patientService';
import {
    checkAndSetRecordIdInCurrentSessionForLog,
    getRecordIdMessageInCurrentSessionForLog,
    setCarePlanLogSessionId,
} from '../../../services/changeLogService';
import patientCache from '../../../utils/patientCache';
import { DEBOUNCE_ALLERGY_LIST_MS } from '../../../constants/timing';
import { SkeletonTable } from '../../../components/common/ContentLoader';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { useNotify } from '../../../context/NotificationContext';
import { useIsTabletOrBelow } from '../../../hooks/useMediaQuery';
const NoProblemData = ({ recordType, showDeleted }) => {
    const label = recordType === 'active' ? 'active problems' : showDeleted ? 'deleted problems' : 'problems in history';
    return (<div className="list-wrapper" style={{ border: '2px solid #ddd', padding: '30px 20px', textAlign: 'center' }}>
      <div className="nodata">
        <LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/>
        <span style={{ fontSize: 20 }}> Patient doesn't have any {label} yet!</span>
      </div>
    </div>);
};
const IcdCodeCell = ({ record }) => (<div className="pp-problem-icd-code-group">
    <div className="pp-icd-code"><span className="pp-icd-label-value" style={{ color: '#37474F', fontWeight: 600 }}>{record.icdCode || '-'}</span></div>
    {record.icdDescription && <div className="pp-icd-code-desc"><span className="pp-icd-label-value">{record.icdDescription}</span></div>}
  </div>);
const SnomedCodeCell = ({ record }) => {
    if (record.snomedCode && record.snomedDesc)
        return (<div className="pp-problem-snomed-code-group">
        <div className="pp-snomed-code"><span className="pp-snomed-label-value" style={{ color: '#37474F', fontWeight: 600 }}>{record.snomedCode}</span></div>
        <div className="pp-snomed-code-desc"><span className="pp-snomed-label-value">{record.snomedDesc}</span></div>
      </div>);
    return <span className="small text-muted">There is no SNOMED CT code linked to {record.icdCode || 'this problem'}.</span>;
};
const TypePill = ({ record }) => (record.diagnosisTypeDesc
    ? <span className="pp-patient-problem-type d-inline-block px-2">{record.diagnosisTypeDesc}</span>
    : <span>-</span>);
const PatientProblemsList = ({ patientId, recordType, showDeleted, searchTerm, filterType, refreshKey, onEdit, onRefresh, }) => {
    const [records, setRecords] = useState(null); // null = fetching (skeleton)
    const { notifyError, notifySuccess } = useNotify();
    const showCards = useIsTabletOrBelow();
    const cacheKey = useMemo(() => `${patientId}_${recordType}_PatientProblemList`, [patientId, recordType]);
    const loadProblems = useCallback(async () => {
        if (!patientId)
            return;
        setRecords(null);
        try {
            const response = await fetchPatientProblems({ patientId, recordType, showDeleted, search: searchTerm, type: filterType });
            const currentRecords = response.records || [];
            setRecords(currentRecords);
            patientCache.set(cacheKey, currentRecords);
        }
        catch (error) {
            console.error('Failed to load patient problems.', error);
            setRecords([]);
            notifyError(error?.message || 'Unable to load problems. Please try again.');
        }
    }, [cacheKey, patientId, recordType, searchTerm, filterType, showDeleted, notifyError]);
    useEffect(() => {
        const timerId = window.setTimeout(loadProblems, DEBOUNCE_ALLERGY_LIST_MS);
        return () => window.clearTimeout(timerId);
    }, [loadProblems, refreshKey]);
    const handleDelete = (record) => {
        if (!window.confirm('Are you sure about deleting the problem record?'))
            return;
        // Legacy auto-generates the delete change-log message from the diagnosis label
        // ("<icd> - <description>") — the user is never prompted for it — reusing/rewriting
        // any message already tracked for this record in the session.
        const diagnosisName = `${record.icdCode || ''} - ${record.icdDescription || ''}`;
        const changeLogNotes = getRecordIdMessageInCurrentSessionForLog('DIAGNOSIS', record.diagnosisId, { name: diagnosisName }, patientId, 'DELETE');
        (async () => {
            try {
                // Concurrency check before deleting (legacy locks with action "DELETE").
                const lock = await checkItIsNewRecordOrEditRecord(patientId, 'PROBLEM', record.diagnosisId, record.versionId ?? 0, 'DELETE');
                if (lock?.status !== 'success')
                    return; // the warning modal was shown
                const response = await deletePatientProblem(buildProblemDeletePayload({ patientId, problemRecord: record, changeLogNotes }));
                // Track the session's change-log grouping so later ops append to one audit entry.
                setCarePlanLogSessionId('DIAGNOSIS', response?.logId, patientId);
                checkAndSetRecordIdInCurrentSessionForLog('DIAGNOSIS', record.diagnosisId, changeLogNotes, 'OLD', patientId);
                // Item 2 — a deleted problem can clear a drug-disease alert; re-evaluate DSI.
                triggerPatientDsiRefresh(patientId);
                notifySuccess('Problem record deleted successfully.');
                onRefresh?.();
            }
            catch (error) {
                console.error('Failed to delete problem.', error);
                notifyError(error?.message || 'Failed to delete the problem record.');
            }
        })();
    };
    if (records === null)
        return <SkeletonTable columns={['S.No', 'Problem & ICD Code', 'Type', 'Clinical Status', 'Verification Status', 'Onset Date', '']} rows={5}/>;
    if (!records.length)
        return <NoProblemData recordType={recordType} showDeleted={showDeleted}/>;
    const isDeletedRow = (record) => recordType === 'history' && record.invalidFlag === 'Y';
    // Kebab (⋮) dropdown mirroring legacy constructProblemActionIcons: Edit shows only on
    // active (non-deleted) records; Delete is shown on every row — active, history, and
    // deleted alike. The current legacy has no Recover action.
    const renderActions = (record) => {
        const showEdit = recordType === 'active' && record.invalidFlag !== 'Y';
        return (<div className="action-icon-dropdown-group ehr-problem-action-items">
            <LegacyIcon icon="mdi-dots-vertical" className="action-group-icon" data-bs-toggle="dropdown" data-bs-auto-close="true" aria-expanded="false"/>
            <ul className="dropdown-menu action-icon-dropdown-menu-list problem-list-action-items" style={{ minWidth: 195 }}>
              {showEdit && <li><div className="ehr-patient-documents-list-icons pp-edit-problem-details" onClick={() => onEdit?.(record)}><span><LegacyIcon icon="fa-pen" className="action-icon"/></span> Edit</div></li>}
              <li><div className="ehr-patient-documents-list-icons pp-delete-problem-details" onClick={() => handleDelete(record)}><span><LegacyIcon icon="fa-trash-can" className="action-icon"/></span> Delete</div></li>
            </ul>
          </div>);
    };
    if (showCards) {
        return (<div className="pp-problem-card-list mt-2">
          {records.map((record, index) => (<div key={record.diagnosisId || index} className={`card mb-2 shadow-sm pp-problem-card ${isDeletedRow(record) ? 'patient-chart-diagnosis-invalid-problem-record' : ''}`}>
            <div className="card-body p-2 font-14">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <IcdCodeCell record={record}/>
                <div className="d-flex align-items-center gap-1">{renderActions(record)}</div>
              </div>
              <div className="row g-1 mt-2">
                <div className="col-12"><span className="text-muted">SNOMED: </span><SnomedCodeCell record={record}/></div>
                <div className="col-6"><span className="text-muted">Type: </span>{record.diagnosisTypeDesc || '-'}</div>
                <div className="col-6"><span className="text-muted">Clinical: </span>{record.clinicalStatus || '-'}</div>
                <div className="col-6"><span className="text-muted">Verification: </span>{record.verificationStatus || '-'}</div>
                <div className="col-6"><span className="text-muted">Diagnosed: </span>{record.dateOfDiagnosis || '-'}</div>
                {recordType === 'history' && <div className="col-6"><span className="text-muted">Resolved: </span>{record.dateOfResolution || '-'}</div>}
                {record.notes && <div className="col-12"><span className="text-muted">Notes: </span>{record.notes}</div>}
              </div>
            </div>
          </div>))}
        </div>);
    }
    return (<div className="table-scroll-container custom-scrollbar mt-2">
      <table className="table">
        <thead className="thead-border-radius">
          <tr>
            <th>S.No</th>
            <th style={{ width: 450 }}><span>ICD-10 Code</span></th>
            <th style={{ width: 350 }}><span>SNOMED Code</span></th>
            <th style={{ width: 100 }}><span>Type</span></th>
            <th><span>Clinical Status</span></th>
            <th><span>Verification Status</span></th>
            <th><span>Date of Diagnosis</span></th>
            {recordType === 'history' && <th><span>Date of Resolution</span></th>}
            <th style={{ width: 100 }}>Action</th>
          </tr>
        </thead>
        <tbody className="tbody-border-radius">
          {records.map((record, index) => (<tr key={record.diagnosisId || index} className={isDeletedRow(record) ? 'patient-chart-diagnosis-invalid-problem-record' : ''}>
              <td className="patient-chart-diagnosis-problem-record-data">{index + 1}</td>
              <td className="patient-chart-diagnosis-problem-record-data"><IcdCodeCell record={record}/></td>
              <td className="patient-chart-diagnosis-problem-record-data"><SnomedCodeCell record={record}/></td>
              <td className="patient-chart-diagnosis-problem-record-data"><TypePill record={record}/></td>
              <td className="patient-chart-diagnosis-problem-record-data">{record.clinicalStatus || ''}</td>
              <td className="patient-chart-diagnosis-problem-record-data">{record.verificationStatus || ''}</td>
              <td className="patient-chart-diagnosis-problem-record-data">{record.dateOfDiagnosis || ''}</td>
              {recordType === 'history' && <td className="patient-chart-diagnosis-problem-record-data">{record.dateOfResolution || ''}</td>}
              <td className="patient-chart-diagnosis-problem-record-data">
                <div className="d-flex gap-2 align-items-center">{renderActions(record)}</div>
              </td>
            </tr>))}
        </tbody>
      </table>
    </div>);
};
export default PatientProblemsList;
