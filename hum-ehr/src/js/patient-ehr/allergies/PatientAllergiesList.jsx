import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchPatientAllergies } from '../../../services/allergyService';
import patientCache from '../../../utils/patientCache';
import { DEBOUNCE_ALLERGY_LIST_MS } from '../../../constants/timing';
import { useNotify } from '../../../context/NotificationContext';
import NoDataAvailable from '../../../components/NoDataAvailable';
import { LegacyIcon, AllergyIcon, PrescriptionBottleIcon, BowlFoodIcon, BuildingsIcon, PawIcon } from '../../../components/common/CustomIcons';
import DeletedRecordBadge from '../../../components/common/DeletedRecordBadge';

// Custom SVGs (named comps) + LegacyIcon reproduce the original FontAwesome
// allergy-type glyphs (ellipsis, ban). Fallback = AllergyIcon.
const ALLERGY_TYPE_SVG = { DRUG: PrescriptionBottleIcon, FOOD: BowlFoodIcon, ENVI: BuildingsIcon, ANIM: PawIcon };
const ALLERGY_TYPE_FA = { AOTH: 'fa-ellipsis', NKA: 'fa-ban', NKDA: 'fa-ban' };
const AllergyTypeIcon = ({ code }) => {
    const SvgIcon = code && ALLERGY_TYPE_SVG[code];
    if (SvgIcon) return <SvgIcon className="me-2 pa-allergy-icon" />;
    const fa = code && ALLERGY_TYPE_FA[code];
    if (fa) return <LegacyIcon icon={fa} className="me-2 pa-allergy-icon" />;
    return <AllergyIcon className="me-2 pa-allergy-icon" />;
};
const NoAllergyData = ({ recordType, showDeleted }) => {
    const label = recordType === 'active' ? 'active allergies' : showDeleted ? 'deleted allergies' : 'history of allergies';
    return (<NoDataAvailable desc={`No ${label} recorded yet!`} />);
};

/**
 * Left-hand selectable list of the allergy master-detail layout (legacy
 * allergy-list-table-container). Each card selects an allergy; the detail pane
 * on the right renders the chosen record. Actions (edit/delete/recover) live on
 * the detail pane, matching the legacy design.
 */
const PatientAllergiesList = ({ patientId, recordType, showDeleted, searchTerm, advancedFilters, refreshKey, selectedId, onSelect, onRecordsLoaded }) => {
    const [records, setRecords] = useState(null); // null = fetching (skeleton)
    const { notifyError } = useNotify();
    const cacheKey = useMemo(() => `${patientId}_${recordType}_PatientAllergyList`, [patientId, recordType]);

    const loadAllergies = useCallback(async () => {
        if (!patientId) return;
        setRecords(null);
        try {
            const response = await fetchPatientAllergies({ patientId, recordType, showDeleted, searchTerm, advancedFilters });
            const currentRecords = response.records || [];
            setRecords(currentRecords);
            patientCache.set(cacheKey, currentRecords);
            patientCache.set(`${patientId}_allergy_raw_${recordType}`, response.rawRecords || []);
            onRecordsLoaded?.(currentRecords);
        } catch (error) {
            console.error('Failed to load patient allergies.', error);
            setRecords([]);
            onRecordsLoaded?.([]);
            notifyError(error?.message || 'Unable to load allergies. Please try again.');
        }
        // onRecordsLoaded intentionally omitted from deps (stable via parent).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [advancedFilters, cacheKey, patientId, recordType, searchTerm, showDeleted, notifyError]);

    useEffect(() => {
        const timerId = window.setTimeout(loadAllergies, DEBOUNCE_ALLERGY_LIST_MS);
        return () => window.clearTimeout(timerId);
    }, [loadAllergies, refreshKey]);

    if (records === null)
        return (
            <div className="pa-allergy-left-card-list mt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="allergy-card p-2 mb-2">
                        <div className="pa-skeleton-bar mb-2" style={{ width: '70%' }} />
                        <div className="pa-skeleton-bar" style={{ width: '40%' }} />
                    </div>
                ))}
            </div>
        );
    // NKA / NKDA records are represented by the "No Known Allergy" cards above the
    // list, so they are excluded from the per-allergy card rail (matching legacy).
    const visibleRecords = records.filter((record) => !['NKA', 'NKDA'].includes(record.allergyTypeCode));
    if (!visibleRecords.length)
        return <NoAllergyData recordType={recordType} showDeleted={showDeleted} />;

    return (
        <div className="pa-allergy-left-card-list mt-2">
            {visibleRecords.map((record, index) => {
                const isDeletedHistoryRecord = recordType === 'history' && record.invalidFlag === 'Y';
                const isSelected = selectedId != null && String(selectedId) === String(record.allergyId);
                const dateBadge = record.effectiveDate || record.onSetDate || '';
                return (
                    <div
                        key={record.allergyId || index}
                        className={`allergy-card allergy-list-card p-2 mb-2 cursor-pointer ${isSelected ? 'selected' : ''} ${isDeletedHistoryRecord ? 'pa-allergy-deleted-allergy-records' : ''}`}
                        onClick={() => onSelect?.(record)}
                        role="button"
                    >
                        <div className="d-flex align-items-center justify-content-between gap-2">
                            <div className="pa-patient-allergy-icon-type-group d-flex align-items-center flex-grow-1 text-truncate">
                                <AllergyTypeIcon code={record.allergyTypeCode} />
                                <span className="fw-bold text-dark text-truncate">
                                    {record.allergyType || '-'}
                                    {record.allergySubType ? ` (${record.allergySubType})` : ''}
                                </span>
                            </div>
                            {dateBadge && <span className="pa-allergy-card-date-badge text-nowrap small">{String(dateBadge).split(' ')[0]}</span>}
                        </div>
                        {record.criticality && <div className={`small mt-1 ${record.criticalityCode?.toLowerCase() || ''}`}>{record.criticality}</div>}
                        {isDeletedHistoryRecord && <DeletedRecordBadge />}
                    </div>
                );
            })}
        </div>
    );
};
export default PatientAllergiesList;
