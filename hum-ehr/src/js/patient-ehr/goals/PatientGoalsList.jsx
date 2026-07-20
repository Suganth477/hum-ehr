import { useCallback, useEffect, useRef, useState } from 'react';
import moment from '../../../utils/dayjs';
import { extractAllGoals, fetchPatientGoals, fetchSdohGoals, mapSdohGoalsList } from '../../../services/goalService';
import { SkeletonList } from '../../../components/common/ContentLoader';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { useNotify } from '../../../context/NotificationContext';

const relativeTime = (value) => {
    if (!value)
        return '';
    const parsed = moment(value, ['MM-DD-YYYY hh:mm A', 'MM-DD-YYYY', moment.ISO_8601], true);
    return parsed.isValid() ? parsed.fromNow() : value;
};

const goalListLabel = (goal, goalType) => {
    if (goalType === 'patient-goals')
        return `${goal.goalName || ''} ${goal.description ? `- ${goal.description}` : ''}`.trim();
    return goal.goalName || goal.description || '';
};

const PatientGoalsList = ({ patientId, recordType, goalType, searchTerm, showDeleted, refreshKey, userId, selectedGoalId, onSelect, }) => {
    const [records, setRecords] = useState(null); // null = fetching (skeleton)
    const { notifyError } = useNotify();
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;

    const loadGoals = useCallback(async (search) => {
        setRecords(null);
        try {
            let list;
            if (goalType === 'sdoh-goals') {
                const response = await fetchSdohGoals({ patientId, recordType, search });
                list = mapSdohGoalsList(extractAllGoals(response));
            }
            else {
                const response = await fetchPatientGoals({ patientId, recordType, search, userId });
                list = extractAllGoals(response);
            }
            // History view hides deleted (invalidFlag 'Y') rows unless "Show Deleted" is checked.
            let recordsToShow = list;
            if (recordType === 'history') {
                const historyRecords = list.filter((item) => item.invalidFlag === 'N');
                recordsToShow = showDeleted ? list : historyRecords;
            }
            setRecords(recordsToShow);
            onSelectRef.current?.(recordsToShow[0] || null);
        }
        catch (error) {
            console.error('Failed to fetch goals list.', error);
            setRecords([]);
            onSelectRef.current?.(null);
            notifyError(error?.message || 'Failed to fetch goals list.');
        }
    }, [patientId, recordType, goalType, showDeleted, userId, notifyError]);

    useEffect(() => {
        const term = (searchTerm || '').trim();
        const timer = window.setTimeout(() => { loadGoals(term); }, 350);
        return () => window.clearTimeout(timer);
    }, [searchTerm, refreshKey, loadGoals]);

    if (records === null)
        return <SkeletonList rows={5}/>;

    if (!records.length)
        return (<div className="list-wrapper pc-no-list-data-container">
          <div className="nodata d-flex justify-content-center align-items-center">
            <div className="me-2"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/></div>
            <div style={{ fontSize: 18 }}>No goals recorded.</div>
          </div>
        </div>);

    return (<>
      {records.map((goal) => {
        const label = goalListLabel(goal, goalType);
        const isActive = String(goal.goalId) === String(selectedGoalId);
        return (<div key={goal.goalId} className={`row goals-each-detail-container pc-list-each-details-container ${isActive ? 'active' : ''} m-1 p-1 ${goal.invalidFlag === 'Y' ? 'in-active-deleted-record' : ''}`} data-id={goal.goalId} onClick={() => onSelect(goal)}>
            <div className="col-md-9 list-goal-name" title={label}>{label.length > 45 ? `${label.slice(0, 45)}...` : label}</div>
            <div className="col-md-3">
              <div className="list-goal-effective-date pc-list-each-details-date-container">{relativeTime(goal.effectiveDate)}</div>
            </div>
          </div>);
      })}
    </>);
};
export default PatientGoalsList;
