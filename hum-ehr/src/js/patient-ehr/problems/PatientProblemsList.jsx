import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildProblemDeletePayload, deletePatientProblem, fetchPatientProblems } from '../../../services/problemService';
import patientCache from '../../../utils/patientCache';
import { DEBOUNCE_ALLERGY_LIST_MS } from '../../../constants/timing';
import { useNotify } from '../../../context/NotificationContext';
import { useIsTabletOrBelow } from '../../../hooks/useMediaQuery';
const NoProblemData = ({ recordType, showDeleted }) => {
    const label = recordType === 'active' ? 'active problems' : showDeleted ? 'deleted problems' : 'history of problems';
    return (<div className="list-wrapper" style={{ border: '2px solid #ddd', padding: '30px 20px', textAlign: 'center' }}>
      <div className="nodata">
        <i className="mdi mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/>
        <span style={{ fontSize: 20 }}> No {label} recorded yet!</span>
      </div>
    </div>);
};
const IcdCodeCell = ({ record }) => (<div>
    <div className="fw-bold text-dark pp-icd-label-value">{record.icdCode || '-'}</div>
    {record.icdDescription && <div className="text-muted small">{record.icdDescription}</div>}
  </div>);
const SnomedCodeCell = ({ record }) => {
    if (record.snomedCode && record.snomedDesc)
        return (<div>
        <div className="fw-bold text-dark pp-snomed-label-value">{record.snomedCode}</div>
        <div className="text-muted small">{record.snomedDesc}</div>
      </div>);
    return <span className="small text-muted">There is no SNOMED CT code linked to {record.icdCode || 'this problem'}.</span>;
};
const TypePill = ({ record }) => (record.diagnosisTypeDesc
    ? <span className="pp-patient-problem-type d-inline-block px-2">{record.diagnosisTypeDesc}</span>
    : <span>-</span>);
const PatientProblemsList = ({ patientId, recordType, showDeleted, searchTerm, filterType, refreshKey, onEdit, onRecoverEdit, onRefresh, }) => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const { notifyError, notifySuccess } = useNotify();
    const showCards = useIsTabletOrBelow();
    const cacheKey = useMemo(() => `${patientId}_${recordType}_PatientProblemList`, [patientId, recordType]);
    const loadProblems = useCallback(async () => {
        if (!patientId)
            return;
        setLoading(true);
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
        finally {
            setLoading(false);
        }
    }, [cacheKey, patientId, recordType, searchTerm, filterType, showDeleted, notifyError]);
    useEffect(() => {
        const timerId = window.setTimeout(loadProblems, DEBOUNCE_ALLERGY_LIST_MS);
        return () => window.clearTimeout(timerId);
    }, [loadProblems, refreshKey]);
    const handleDelete = (record) => {
        if (!window.confirm('Are you sure about deleting the problem record?'))
            return;
        const changeLogNotes = window.prompt('Enter change log message for deleting this problem record:') || '';
        if (!changeLogNotes.trim())
            return;
        (async () => {
            try {
                await deletePatientProblem(buildProblemDeletePayload({ problemRecord: record, changeLogNotes }));
                notifySuccess('Problem record deleted.');
                onRefresh?.();
            }
            catch (error) {
                console.error('Failed to delete problem.', error);
                notifyError(error?.message || 'Failed to delete the problem record.');
            }
        })();
    };
    if (loading)
        return <div className="p-3 text-muted small">Loading problems...</div>;
    if (!records.length)
        return <NoProblemData recordType={recordType} showDeleted={showDeleted}/>;
    const isDeletedRow = (record) => recordType === 'history' && record.invalidFlag === 'Y';
    const renderActions = (record) => {
        if (recordType === 'active')
            return (<>
                <button type="button" className="btn btn-default border-0 action-icon p-1 pp-edit-problem-details" title="Edit" onClick={() => onEdit?.(record)}><i className="fa-regular fa-pencil"/></button>
                <button type="button" className="btn btn-default border-0 action-icon p-1 pp-delete-problem-details" title="Delete" onClick={() => handleDelete(record)}><i className="fa-regular fa-trash-can"/></button>
              </>);
        if (isDeletedRow(record))
            return (<button type="button" className="btn btn-default border-0 action-icon p-1 pp-edit-problem-details" title="Recover" onClick={() => onRecoverEdit?.(record)}><i className="fa-regular fa-rotate"/></button>);
        return null;
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
    return (<div className="table-scroll-container table-responsive bg-white rounded border mt-2">
      <table className="table align-middle text-start mb-0">
        <thead className="thead-border-radius table-light">
          <tr className="small text-muted text-uppercase">
            <th>S.No</th>
            <th style={{ width: 320 }}>ICD-10 Code</th>
            <th style={{ width: 300 }}>SNOMED Code</th>
            <th style={{ width: 90 }}>Type</th>
            <th>Clinical Status</th>
            <th>Verification Status</th>
            <th>Date of Diagnosis</th>
            {recordType === 'history' && <th>Date of Resolution</th>}
            <th style={{ width: 90 }}/>
          </tr>
        </thead>
        <tbody className="tbody-border-radius font-14">
          {records.map((record, index) => (<tr key={record.diagnosisId || index} className={isDeletedRow(record) ? 'patient-chart-diagnosis-invalid-problem-record' : ''}>
              <td className="pp-problem-records-data"><span>{index + 1}</span></td>
              <td className="pp-problem-records-data"><IcdCodeCell record={record}/></td>
              <td className="pp-problem-records-data"><SnomedCodeCell record={record}/></td>
              <td className="pp-problem-records-data"><TypePill record={record}/></td>
              <td className="pp-problem-records-data"><span>{record.clinicalStatus || ''}</span></td>
              <td className="pp-problem-records-data"><span>{record.verificationStatus || ''}</span></td>
              <td className="pp-problem-records-data"><span>{record.dateOfDiagnosis || '-'}</span></td>
              {recordType === 'history' && <td className="pp-problem-records-data"><span>{record.dateOfResolution || '-'}</span></td>}
              <td className="pp-problem-records-data">
                <div className="d-flex align-items-center gap-2">{renderActions(record)}</div>
              </td>
            </tr>))}
        </tbody>
      </table>
    </div>);
};
export default PatientProblemsList;
