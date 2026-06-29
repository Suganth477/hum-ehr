import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { buildDeletePayload, buildRecoverPayload, deletePatientAllergy, fetchPatientAllergies, recoverPatientAllergy, } from '../../../services/allergyService';
import patientCache from '../../../utils/patientCache';
import { DEBOUNCE_ALLERGY_LIST_MS } from '../../../constants/timing';
import { useNotify } from '../../../context/NotificationContext';
import { useIsTabletOrBelow } from '../../../hooks/useMediaQuery';
import NoDataAvailable from '../../../components/NoDataAvailable';

const swalTheme = Swal.mixin({
    customClass: {
        popup: 'pa-swal-popup',
        title: 'pa-swal-title',
        confirmButton: 'pa-swal-confirm',
        cancelButton: 'pa-swal-cancel',
        input: 'pa-swal-input',
    },
    buttonsStyling: false,
    showCancelButton: true,
    reverseButtons: false,
    allowOutsideClick: false,
});
const ALLERGY_TYPE_ICONS = {
    DRUG: 'fa-prescription-bottle-medical',
    FOOD: 'fa-bowl-food',
    ENVI: 'fa-buildings',
    AOTH: 'fa-ellipsis',
    ANIM: 'fa-paw',
    NKA: 'fa-ban',
    NKDA: 'fa-ban',
};
const AllergyTypeIcon = ({ code }) => (<i className={`fa-solid ${(code && ALLERGY_TYPE_ICONS[code]) || 'fa-hand-dots'} me-2 pa-allergy-icon`}/>);
const NoAllergyData = ({ recordType, showDeleted }) => {
    const label = recordType === 'active' ? 'active allergies' : showDeleted ? 'deleted allergies' : 'history of allergies';
    return (<NoDataAvailable desc={`No ${label} recorded yet!`} />);
};
const PatientAllergiesList = ({ patientId, recordType, showDeleted, searchTerm, advancedFilters, refreshKey, onEdit, onRecoverEdit, onRefresh, }) => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedReactions, setExpandedReactions] = useState({});
    const [expandedDescription, setExpandedDescription] = useState({});
    const { notifyError, notifySuccess } = useNotify();
    const showCards = useIsTabletOrBelow();
    const cacheKey = useMemo(() => `${patientId}_${recordType}_PatientAllergyList`, [patientId, recordType]);
    const loadAllergies = useCallback(async () => {
        if (!patientId)
            return;
        setLoading(true);
        try {
            const response = await fetchPatientAllergies({ patientId, recordType, showDeleted, searchTerm, advancedFilters });
            const currentRecords = response.records || [];
            setRecords(currentRecords);
            patientCache.set(cacheKey, currentRecords);
            patientCache.set(`${patientId}_allergy_raw_${recordType}`, response.rawRecords || []);
        }
        catch (error) {
            console.error('Failed to load patient allergies.', error);
            setRecords([]);
            notifyError(error?.message || 'Unable to load allergies. Please try again.');
        }
        finally {
            setLoading(false);
        }
    }, [advancedFilters, cacheKey, patientId, recordType, searchTerm, showDeleted, notifyError]);
    useEffect(() => {
        const timerId = window.setTimeout(loadAllergies, DEBOUNCE_ALLERGY_LIST_MS);
        return () => window.clearTimeout(timerId);
    }, [loadAllergies, refreshKey]);
    useEffect(() => {
        setExpandedReactions({});
        setExpandedDescription({});
    }, [patientId, recordType, showDeleted, refreshKey]);
    const handleDelete = async (record) => {
        const confirm = await swalTheme.fire({
            title: 'Delete Allergy Record',
            text: 'Are you sure about deleting the allergy record?',
            confirmButtonText: 'YES',
            cancelButtonText: 'NO',
        });
        if (!confirm.isConfirmed) return;
        const autoMessage = `An existing allergy "${record.allergyType}" has been deleted`;
        try {
            await deletePatientAllergy(buildDeletePayload({ patientId, allergyRecord: record, changeLogNotes: autoMessage }));
            notifySuccess('Allergy record deleted.');
            onRefresh?.();
        } catch (error) {
            console.error('Failed to delete allergy.', error);
            notifyError(error?.message || 'Failed to delete the allergy record.');
        }
    };
    const handleRecover = async (record) => {
        const confirm = await swalTheme.fire({
            title: 'Recover Allergy Record',
            text: 'Are you sure about recovering this allergy record?',
            confirmButtonText: 'YES',
            cancelButtonText: 'NO',
        });
        if (!confirm.isConfirmed) return;
        const autoMessage = `An existing allergy "${record.allergyType}" has been recovered`;
        try {
            await recoverPatientAllergy(buildRecoverPayload({ patientId, allergyRecord: record, changeLogNotes: autoMessage }));
            notifySuccess('Allergy record recovered.');
            onRefresh?.();
        } catch (error) {
            console.error('Failed to recover allergy.', error);
            notifyError(error?.message || 'Failed to recover the allergy record.');
        }
    };
    const toggleReaction = (allergyId) => setExpandedReactions((previous) => ({ ...previous, [allergyId]: !previous[allergyId] }));
    const toggleDescription = (allergyId) => setExpandedDescription((previous) => ({ ...previous, [allergyId]: !previous[allergyId] }));
    const getSeverityBadgeClass = (severityName) => {
        const severity = severityName?.toLowerCase() || '';
        if (severity.includes('severe') || severity.includes('high'))
            return 'severe';
        if (severity.includes('moderate'))
            return 'moderate';
        return 'mild';
    };
    const renderDescription = (record) => {
        const description = record.description || '';
        if (!description)
            return '-';
        const key = String(record.allergyId);
        const expanded = expandedDescription[key];
        const isLong = description.length > 80;
        const visibleText = expanded || !isLong ? description : `${description.slice(0, 80)}...`;
        return (<div>
        <span>{visibleText}</span>
        {isLong && (<button type="button" className="btn btn-link p-0 ms-1 small text-decoration-none" onClick={() => toggleDescription(key)}>
            {expanded ? 'View less..' : 'View more..'}
          </button>)}
      </div>);
    };
    if (loading)
        return (
            <div className="pa-allergy-table-outer bg-white border mt-2">
              <div className="table-responsive">
                <table className="table align-middle text-start mb-0">
                    <thead className="table-light">
                        <tr className="small text-muted">
                            <th>S.No</th>
                            <th style={{ width: 280 }}>Allergy Type, Subtype &amp; Criticality</th>
                            <th style={{ width: 250 }}>Reaction</th>
                            <th style={{ width: 100 }}>Severity</th>
                            <th style={{ width: 300 }}>Description</th>
                            <th>Clinical Status</th>
                            <th>Verification Status</th>
                            <th>Onset Date and Time</th>
                            <th style={{ width: 100 }} />
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <tr key={i}>
                                <td><div className="pa-skeleton-bar" style={{ width: 20 }} /></td>
                                <td>
                                    <div className="pa-skeleton-bar mb-2" style={{ width: 120 }} />
                                    <div className="pa-skeleton-bar" style={{ width: 80 }} />
                                </td>
                                <td><div className="pa-skeleton-bar" style={{ width: 110 }} /></td>
                                <td><div className="pa-skeleton-bar" style={{ width: 60 }} /></td>
                                <td><div className="pa-skeleton-bar" style={{ width: 160 }} /></td>
                                <td><div className="pa-skeleton-bar" style={{ width: 70 }} /></td>
                                <td><div className="pa-skeleton-bar" style={{ width: 80 }} /></td>
                                <td><div className="pa-skeleton-bar" style={{ width: 100 }} /></td>
                                <td><div className="pa-skeleton-bar" style={{ width: 40 }} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
            </div>
        );
    if (!records.length)
        return <NoAllergyData recordType={recordType} showDeleted={showDeleted}/>;
    if (showCards) {
        return (<div className="pa-allergy-card-list mt-2">
          {records.map((record, index) => {
            const reactions = record.reactionMapping || [];
            const isDeletedHistoryRecord = recordType === 'history' && record.invalidFlag === 'Y';
            return (<div key={record.allergyId || index} className={`card mb-2 shadow-sm pa-allergy-card ${isDeletedHistoryRecord ? 'pa-allergy-deleted-allergy-records' : ''}`}>
              <div className="card-body p-2 font-14">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div className="pa-patient-allergy-icon-type-group">
                    <AllergyTypeIcon code={record.allergyTypeCode}/>
                    <span className="fw-bold text-dark">{record.allergyType || '-'}</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    {recordType === 'active' && (<>
                        <button type="button" className="btn btn-default border-0 action-icon p-1" title="Edit" onClick={() => onEdit?.(record)}><i className="fa-regular fa-pencil"/></button>
                        <button type="button" className="btn btn-default border-0 action-icon p-1" title="Delete" onClick={() => handleDelete(record)}><i className="fa-regular fa-trash-can"/></button>
                      </>)}
                    {isDeletedHistoryRecord && (<>
                        <button type="button" className="btn btn-default border-0 action-icon p-1" title="Recover/Edit" onClick={() => onRecoverEdit?.(record)}><i className="fa-regular fa-pencil"/></button>
                        <button type="button" className="btn btn-default border-0 action-icon p-1" title="Recover" onClick={() => handleRecover(record)}><i className="fa-regular fa-rotate"/></button>
                      </>)}
                  </div>
                </div>
                {record.allergySubType && <div className="text-muted text-capitalize">{record.allergySubType}</div>}
                {record.criticality && <div className={`small ${record.criticalityCode?.toLowerCase() || ''}`}>{record.criticality}</div>}
                <div className="row g-1 mt-2">
                  <div className="col-12">
                    <span className="text-muted">Reactions: </span>
                    {reactions.length
                      ? reactions.map((reaction, idx) => (<span key={`${record.allergyId}_${reaction.reactionId || idx}`} className={`me-2 ${getSeverityBadgeClass(reaction.severity)}`}>
                          {reaction.reaction}{reaction.severity ? ` (${reaction.severity})` : ''}
                        </span>))
                      : '-'}
                  </div>
                  <div className="col-12"><span className="text-muted">Description: </span>{record.description || '-'}</div>
                  <div className="col-6"><span className="text-muted">Clinical: </span>{record.allergyClinicalStatus || '-'}</div>
                  <div className="col-6"><span className="text-muted">Verification: </span>{record.verificationStatus || '-'}</div>
                  <div className="col-6"><span className="text-muted">Onset: </span>{record.onSetDate || record.effectiveDate || '-'}</div>
                  {recordType === 'history' && <div className="col-6"><span className="text-muted">Resolved: </span>{record.lastEffectiveDate || '-'}</div>}
                </div>
              </div>
            </div>);
          })}
        </div>);
    }
    return (<div className="pa-allergy-table-outer bg-white border mt-2">
      <div className="table-responsive">
      <table className="table align-middle text-start mb-0">
        <thead className="table-light">
          <tr className="small text-muted">
            <th>S.No</th>
            <th style={{ width: 280 }}>Allergy Type, Subtype &amp; Criticality</th>
            <th style={{ width: 250 }}>Reaction</th>
            <th style={{ width: 100 }}>Severity</th>
            <th style={{ width: 300 }}>Description</th>
            <th>Clinical Status</th>
            <th>Verification Status</th>
            <th>Onset Date and Time</th>
            {recordType === 'history' && <th>Date of Resolution</th>}
            <th style={{ width: 100 }}/>
          </tr>
        </thead>
        <tbody className="font-14">
          {records.map((record, index) => {
            const reactions = record.reactionMapping || [];
            const key = String(record.allergyId);
            const expanded = expandedReactions[key];
            const visibleReactions = expanded ? reactions : reactions.slice(0, 2);
            const remainingReactionCount = Math.max(reactions.length - 2, 0);
            const isDeletedHistoryRecord = recordType === 'history' && record.invalidFlag === 'Y';
            return (<tr key={record.allergyId || index} className={isDeletedHistoryRecord ? 'pa-allergy-deleted-allergy-records' : ''}>
                <td className="pa-allergy-records-data"><span>{index + 1}</span></td>
                <td className="pa-allergy-records-data">
                  <div className="pa-patient-allergy-icon-type-group">
                    <AllergyTypeIcon code={record.allergyTypeCode}/>
                    <span className="pa-patient-allergy-type-desc fw-bold text-dark">{record.allergyType || '-'}</span>
                  </div>
                  {record.allergySubType && <div className="pa-patient-allergy-subtype text-muted text-capitalize">{record.allergySubType}</div>}
                  {record.criticality && <div className={`pa-patient-allergy-criticality mt-1 small ${record.criticalityCode?.toLowerCase() || ''}`}>{record.criticality}</div>}
                </td>
                <td className="pa-allergy-records-data">
                  {visibleReactions.map((reaction, idx) => (<div key={`${key}_${reaction.reactionId || idx}`} className="pa-allergy-each-reaction-description py-1">
                      {reaction.reaction || '-'}
                    </div>))}
                  {remainingReactionCount > 0 && (<button type="button" className="pa-allergy-reaction-toggle-btn btn btn-link p-0 small text-decoration-none" onClick={() => toggleReaction(key)}>
                      {expanded ? 'Hide..' : `Show ${remainingReactionCount} more reaction..`}
                    </button>)}
                </td>
                <td className="pa-allergy-records-data">
                  {visibleReactions.length
                    ? visibleReactions.map((reaction, idx) => (<div key={`${key}_${reaction.severityId || idx}`} className={`pa-allergy-each-reaction-severity my-1 ${getSeverityBadgeClass(reaction.severity)}`}>
                          {reaction.severity || '-'}
                        </div>))
                    : '-'}
                </td>
                <td className="pa-allergy-records-data"><span className="pa-allergy-description-data">{renderDescription(record)}</span></td>
                <td className="pa-allergy-records-data"><span>{record.allergyClinicalStatus || ''}</span></td>
                <td className="pa-allergy-records-data"><span>{record.verificationStatus || ''}</span></td>
                <td className="pa-allergy-records-data"><span>{record.onSetDate || record.effectiveDate || '-'}</span></td>
                {recordType === 'history' && <td className="pa-allergy-records-data"><span>{record.lastEffectiveDate || '-'}</span></td>}
                <td className="pa-allergy-records-data">
                  <div className="action-icon-dropdown-group">
                    <div className="d-flex align-items-center gap-2">
                      {recordType === 'active' && (<>
                          <button type="button" className="btn btn-default border-0 action-icon ms-2 d-block pa-edit-recover-allergy-details" data-action="edit" title="Edit" onClick={() => onEdit?.(record)}>
                            <i className="fa-regular fa-pencil"/>
                          </button>
                          <button type="button" className="btn btn-default border-0 pa-delete-allergy-details action-icon" data-action="delete" title="Delete" onClick={() => handleDelete(record)}>
                            <i className="fa-regular fa-trash-can"/>
                          </button>
                        </>)}
                      {isDeletedHistoryRecord && (<>
                          <button type="button" className="btn btn-default border-0 pa-edit-recover-allergy-details action-icon" data-action="recover" title="Recover/Edit" onClick={() => onRecoverEdit?.(record)}>
                            <i className="fa-regular fa-pencil"/>
                          </button>
                          <button type="button" className="btn btn-default border-0 pa-edit-recover-allergy-details action-icon" data-action="recover" title="Recover" onClick={() => handleRecover(record)}>
                            <i className="fa-regular fa-rotate"/>
                          </button>
                        </>)}
                    </div>
                  </div>
                </td>
              </tr>);
        })}
        </tbody>
      </table>
      </div>
    </div>);
};
export default PatientAllergiesList;
