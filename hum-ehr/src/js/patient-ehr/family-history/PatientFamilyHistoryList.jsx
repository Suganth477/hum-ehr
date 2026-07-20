import { useCallback, useEffect, useRef, useState } from 'react';
import moment from '../../../utils/dayjs';
import { fetchFamilyHistory, deleteFamilyMember } from '../../../services/familyHistoryService';
import { SkeletonTable } from '../../../components/common/ContentLoader';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { useNotify } from '../../../context/NotificationContext';

/**
 * Read view of the family-history matrix (legacy PatientFamilyHistoryList): family
 * members are columns, SNOMED conditions are rows, each cell shows Yes/No (+ a notes
 * book icon when the member has condition notes). A member column can be deleted.
 */
const PatientFamilyHistoryList = ({ patientId, refreshKey, onDataLoaded }) => {
    const [members, setMembers] = useState(null); // null = fetching (skeleton)
    const [diseases, setDiseases] = useState([]);
    const [busy, setBusy] = useState(false);
    const { notifyError, notifySuccess } = useNotify();
    const onDataLoadedRef = useRef(onDataLoaded);
    onDataLoadedRef.current = onDataLoaded;

    const load = useCallback(async () => {
        setMembers(null);
        try {
            const { members: m, diseases: d } = await fetchFamilyHistory(patientId);
            setMembers(m);
            setDiseases(d);
            onDataLoadedRef.current?.(m.length > 0);
        }
        catch (error) {
            console.error('Failed to fetch family history details.', error);
            setMembers([]);
            setDiseases([]);
            onDataLoadedRef.current?.(false);
            notifyError(error?.message || 'Failed to fetch family history details. Please try again.');
        }
    }, [patientId, notifyError]);

    useEffect(() => { load(); }, [load, refreshKey]);

    const handleDelete = async (member) => {
        if (!window.confirm('Are you sure about deleting the family history record?')) return;
        setBusy(true);
        try {
            const changeLogMessage = `Family member "${member.fullName || ''}" (${member.relationShipDesc || ''}) has been deleted`;
            const response = await deleteFamilyMember({ patientId, memberDetailId: member.memberId, changeLogMessage });
            if (!response || response.status === 'success') {
                notifySuccess('Family Member record deleted successfully.');
                load();
            }
            else notifyError(response.message || 'Failed to delete the record. Please try again.');
        }
        catch (error) {
            console.error('Failed to delete family history record.', error);
            notifyError(error?.message || 'Failed to delete the record. Please try again.');
        }
        finally { setBusy(false); }
    };

    if (members === null)
        return <SkeletonTable columns={['Conditions', '', '', '']} rows={5}/>;

    if (!members.length)
        return (<div className="list-wrapper" style={{ border: '2px solid #ddd', padding: '30px 20px', textAlign: 'center' }}>
          <div className="nodata"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 40, verticalAlign: 'sub' }}/>
            <span style={{ fontSize: 20 }}> Patient doesn't have any family history yet! </span>
          </div>
        </div>);

    // Per (snomedCode, memberId) → the member's condition entry (for Yes + notes).
    const cellFor = (disease, memberId) => (disease.memberList || []).find((x) => String(x.memberId) === String(memberId));

    return (<div className="pcfh-table-scroll-container">
      <table className="table pcfh-table">
        <thead className="thead-border-radius">
          <tr>
            <th/>
            {members.map((m) => (
              <th key={m.memberId} data-member-id={m.memberId}>
                {m.relationShipDesc}
                <span className="pfsh-delete-family-history pcfh-delete-family-history ps-2" role="button" title="Delete Relation"
                  onClick={busy ? undefined : () => handleDelete(m)}>
                  <span className="pcfh-delete-family-member-icon"><LegacyIcon icon="fa-trash" className="p-0 m-0"/></span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pcfh-family-member-details-title" style={{ zIndex: 10 }}>Family Member Details</td>
            {members.map((m) => (
              <td key={m.memberId} className="pcfh-member-cell" data-member-id={m.memberId}>
                <div className="text-capitalize" style={{ whiteSpace: 'nowrap' }}><span className="pcfh-label-color">Name:</span> {m.fullName}</div>
                <div><span className="pcfh-label-color">Birth Year:</span> {m.memberDob || ''}</div>
                <div><span className="pcfh-label-color">Age:</span> {m.memberDob ? moment().year() - Number(m.memberDob) : ''}</div>
                <div><span className="pcfh-label-color">Deceased:</span> {m.isDiseased === 'Y' ? 'Yes' : 'No'}</div>
              </td>
            ))}
          </tr>
          {diseases.map((d) => (
            <tr key={d.snomedCode}>
              <td data-snomed-code={d.snomedCode}>
                <div style={{ width: 250, whiteSpace: 'normal' }}>{d.snomedDesc}</div>
                <div>SNOMED Code: {d.snomedCode}</div>
              </td>
              {members.map((m) => {
                const cell = cellFor(d, m.memberId);
                return (<td key={m.memberId} className="pcfh-condition-cell">
                  {cell ? (<>
                    <span className="fw-bold">Yes</span>
                    {cell.notes ? <LegacyIcon icon="fa-book" className="pcfh-condition-notes active-condition green ms-1" title={cell.notes} role="button"/> : null}
                  </>) : <span className="fw-bold">No</span>}
                </td>);
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>);
};
export default PatientFamilyHistoryList;
