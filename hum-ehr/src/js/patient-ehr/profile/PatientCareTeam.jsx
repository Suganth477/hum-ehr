import { useCallback, useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import {
    getPatientDetails, fetchCarePlanDetails, fetchPhysiciansList, fetchCliniciansList, fetchOrSaveCareTeam,
} from '../../../services/patientProfileService';
import PatientSpecialtyProviders from './PatientSpecialtyProviders';
import { SkeletonViewDetails } from '../../../components/common/ContentLoader';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { useNotify } from '../../../context/NotificationContext';

// Legacy server-injected role labels (tenant-configurable JSP constants).
export const ROLE_DESC_PROVIDER = 'Physician';
export const ROLE_PRIMARY_CARE_COORDINATOR = 'Primary Patient Care Coordinator';

const initialsFromName = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

const alertTooltip = (alertCommunicationType) => (alertCommunicationType === 'ALL-PATI'
    ? `Since Alert Communication is set as 'All Patient's in ${ROLE_DESC_PROVIDER} setup screen, Alert Communication Flag is set to 'Yes'`
    : alertCommunicationType === 'NO-PATI'
        ? `Since Alert Communication is set as "No Patients" in ${ROLE_DESC_PROVIDER} setup screen, Alert Communication Flag is set to "No"`
        : '');

// Hoisted so parent re-renders don't remount the card subtree.
const MemberCard = ({ sectionKey, title, cardLabel, member, users, canChange, onEdit }) => {
    const name = users?.[member?.id]?.name || '';
    return (
      <div className="col-md-6">
        <div className="pp-care-team-section-name">{title}</div>
        <div className="pp-care-team-card">
          <div className="pp-member-avatar text-uppercase">{initialsFromName(name)}</div>
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="fw-semibold text-capitalize" style={{ color: '#37474F' }}>{name}</div>
            <div className="d-flex align-items-center gap-4 flex-wrap">
              <span>{cardLabel}</span>
              <span>Alert Communication: <span>{member?.alertFlag === 'Y' ? ' Yes' : 'No'}</span></span>
            </div>
          </div>
          <button type="button" className="btn p-1" title="Edit" disabled={canChange !== 'Y'}
            style={canChange !== 'Y' ? { border: 'none', cursor: 'not-allowed' } : {}}
            onClick={() => onEdit(sectionKey)}>
            <LegacyIcon icon="mdi-pencil" style={{ fontSize: 16 }}/>
          </button>
        </div>
      </div>
    );
};

/**
 * Care Team tab (legacy patient-care-team-status-*): Care Plan Physician +
 * Primary Patient Care Coordinator cards (editable when the careplan allows a
 * change), and the Specialty Providers accordion. Fetch and save both go
 * through POST /careteam.
 */
const PatientCareTeam = ({ patientId }) => {
    const { notifySuccess, notifyError } = useNotify();
    const [state, setState] = useState(null); // { careTeam, physicians, clinicians, changeProvider, changeStaffNurse }
    const [dialog, setDialog] = useState(null); // { section: 'physician'|'clinician' }
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [alertChecked, setAlertChecked] = useState(false);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            const details = await getPatientDetails(patientId);
            const [carePlan, physicians, clinicians] = await Promise.all([
                fetchCarePlanDetails(patientId, details?.carePlanId || ''),
                fetchPhysiciansList(details?.facility),
                fetchCliniciansList(details?.facility),
            ]);
            const careTeamResponse = await fetchOrSaveCareTeam({ patientId });
            if (careTeamResponse?.status !== 'success') throw new Error('care team fetch failed');
            setState({
                careTeam: { physician: careTeamResponse.data.physicians, clinician: careTeamResponse.data.clinician },
                physicians, clinicians,
                changeProvider: carePlan.changePhysician || 'N',
                changeStaffNurse: carePlan.changeClinician || 'N',
            });
        }
        catch (error) {
            console.error('Failed to load care team.', error);
            notifyError(`Failed to get the list ${ROLE_DESC_PROVIDER.toLowerCase()}s and clinicians. Please try again`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId]);
    useEffect(() => { load(); }, [load]);

    const openEdit = (section) => {
        const member = section === 'physician' ? state.careTeam.physician : state.careTeam.clinician;
        setSelectedMemberId(String(member?.id ?? ''));
        setAlertChecked(member?.alertFlag === 'Y');
        setDialog({ section });
    };

    const memberList = dialog?.section === 'physician' ? state?.physicians : state?.clinicians;
    const selectedMemberMeta = memberList?.[selectedMemberId];
    const alertCommType = selectedMemberMeta?.alertCommunication;
    const originalMember = dialog?.section === 'physician' ? state?.careTeam.physician : state?.careTeam.clinician;
    const providerChangedWarning = dialog?.section === 'physician' && String(originalMember?.id) !== String(selectedMemberId);

    const onMemberChange = (value) => {
        setSelectedMemberId(value);
        const meta = memberList?.[value];
        if (dialog.section === 'physician') setAlertChecked(meta?.alertCommunication === 'ALL-PATI');
        else setAlertChecked(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const request = {
                patientId,
                physicianId: dialog.section === 'physician' ? selectedMemberId : null,
                clinicianId: dialog.section === 'physician' ? null : selectedMemberId,
                alertFlag: alertChecked ? 'Y' : 'N',
            };
            const response = await fetchOrSaveCareTeam(request);
            if (response?.status === 'success') {
                notifySuccess(dialog.section === 'physician'
                    ? `Care Plan ${ROLE_DESC_PROVIDER} updated successfully.`
                    : `${ROLE_PRIMARY_CARE_COORDINATOR} updated successfully.`);
                setState((prev) => ({ ...prev, careTeam: { physician: response.data.physicians, clinician: response.data.clinician } }));
                setDialog(null);
            }
            else {
                notifyError(dialog.section === 'physician'
                    ? `Failed to Update Care Plan ${ROLE_DESC_PROVIDER}. Please try again.`
                    : `Failed to Update ${ROLE_PRIMARY_CARE_COORDINATOR}. Please try again.`);
            }
        }
        catch (error) { console.error('Failed to save care team.', error); notifyError('Failed to update care team. Please try again.'); }
        finally { setSaving(false); }
    };

    if (!state) return <SkeletonViewDetails rows={2} cols={2}/>;

    return (<div className="container-fluid py-2">
      <div className="row">
        <MemberCard sectionKey="physician" title={ROLE_DESC_PROVIDER} cardLabel={`Care Plan ${ROLE_DESC_PROVIDER}`}
          member={state.careTeam.physician} users={state.physicians} canChange={state.changeProvider} onEdit={openEdit}/>
        <MemberCard sectionKey="clinician" title={ROLE_PRIMARY_CARE_COORDINATOR} cardLabel={ROLE_PRIMARY_CARE_COORDINATOR}
          member={state.careTeam.clinician} users={state.clinicians} canChange={state.changeStaffNurse} onEdit={openEdit}/>
      </div>

      <PatientSpecialtyProviders patientId={patientId}/>

      <Dialog visible={!!dialog} onHide={() => setDialog(null)}
        header={dialog?.section === 'physician' ? `Edit Specialty ${ROLE_DESC_PROVIDER.toLowerCase()}` : `Edit ${ROLE_PRIMARY_CARE_COORDINATOR}`}
        style={{ width: '50vw' }} breakpoints={{ '992px': '95vw' }}>
        {dialog && (<form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="row g-3 align-items-end">
            <div className="col-md-6">
              <label>{dialog.section === 'physician' ? `Care Plan ${ROLE_DESC_PROVIDER}` : ROLE_PRIMARY_CARE_COORDINATOR}</label>
              <select className="form-select" value={selectedMemberId} onChange={(e) => onMemberChange(e.target.value)}>
                {Object.entries(memberList || {}).map(([id, user]) => (
                  <option key={id} value={id}>{user.name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="d-flex align-items-center gap-2 mb-2" title={alertTooltip(alertCommType)}>
                <input type="checkbox" checked={alertChecked} disabled={alertCommType !== 'SELE-PATI'}
                  style={alertCommType !== 'SELE-PATI' ? { cursor: 'not-allowed' } : {}}
                  onChange={(e) => setAlertChecked(e.target.checked)}/>
                Alert Communication
              </label>
            </div>
          </div>
          {providerChangedWarning && (
            <div className="mt-2 small text-danger">
              <LegacyIcon icon="fa-exclamation-triangle" className="me-1"/>
              <strong>Warning: </strong> Services already exist for this patient. Do you still want to Change the care plan provider?
            </div>
          )}
          <div className="d-flex justify-content-end gap-2 mt-3">
            <button type="button" className="btn btn-primary rounded-pill px-4" disabled={saving}
              onClick={() => { if (window.confirm(`Are you sure about cancel ${dialog.section === 'physician' ? 'Provider' : ROLE_PRIMARY_CARE_COORDINATOR} form?`)) setDialog(null); }}>Cancel</button>
            <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>)}
      </Dialog>
    </div>);
};
export default PatientCareTeam;
