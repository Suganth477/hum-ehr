import { useCallback, useEffect, useState } from 'react';
import { getPatientDetails, refreshPatientDetails, saveMobileAccess } from '../../../services/patientProfileService';
import { SkeletonViewDetails } from '../../../components/common/ContentLoader';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { useNotify } from '../../../context/NotificationContext';

const FieldError = ({ message }) => (message ? <div className="small text-danger mt-1">{message}</div> : null);
const USERNAME_RE = /^([a-zA-Z0-9]*?[@]{0,1}?[a-zA-Z0-9]*?[.]{0,1}?[a-zA-Z0-9]*|[a-zA-Z0-9]*?[.]{0,1}?[a-zA-Z0-9]*?[@]{0,1}?[a-zA-Z0-9]*)$/i;
const PASSWORD_RE = /(?=^.{8,20}$)(?=.*\d)(?=^\S*$)(?=.*[!@#$%^&*]+)(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;

const RULES_TOOLTIP = `Rules to follow while creating a new username and password
1. The Username should contain a minimum of 8 characters and a maximum of 25 characters.
2. Username should contain only numbers, letters, and any of the special characters .@ only once.
3. The Password should contain a minimum of 8 characters and a maximum of 20 characters.
4. Password should mandatorily contain at least a number, an uppercase letter, a lowercase letter, and one of the special characters !@#$%^&*
5. Blank space is not allowed.`;

/**
 * Mobile App Access (legacy patient-mobile-access-*): view (access flag +
 * credentials) and edit (enable access, username/temporary password with the
 * legacy rules, credential send-via with per-channel eligibility warnings,
 * Send/Resend Credentials). Save posts the legacy payload shape to
 * /patient/update/mobileaccess.
 */
const PatientMobileAccess = ({ patientId }) => {
    const { notifySuccess, notifyError } = useNotify();
    const [details, setDetails] = useState(null);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState(null);
    const [errors, setErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try { setDetails(await getPatientDetails(patientId)); }
        catch (error) { console.error(error); }
    }, [patientId]);
    useEffect(() => { load(); }, [load]);

    const anyPhone = details && (details.mobilePhone || details.workPhone || details.homePhone || details.otherPhone);
    const accessEnabled = details?.enableMobileAppAccess === 'Y';

    const openEdit = () => {
        setForm({
            mobileAccess: accessEnabled,
            userName: accessEnabled ? details.userName || '' : '',
            password: accessEnabled ? details.patientPassword || '' : '',
            email: accessEnabled ? details.email || '' : '',
            sendVia: details.credentialSendVia || 'EMAIL',
        });
        setErrors({});
        setEditing(true);
    };

    const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));
    const clearError = (key) => setErrors((prev) => { if (!prev[key]) return prev; const next = { ...prev }; delete next[key]; return next; });

    // Send-button eligibility + warning (legacy onChangeSendViaCredential).
    const sendState = (() => {
        if (!details || !form) return { enabled: false, warning: '' };
        const { phoneNumberStatus, mobilePhone, email } = details;
        switch (form.sendVia) {
            case 'BOTH':
                return {
                    enabled: !!(phoneNumberStatus === 'PTVALID' && mobilePhone && email),
                    warning: phoneNumberStatus !== 'PTVALID' ? 'Mobile number not verified for Text Message' : !email ? 'Email not added for the patient.' : '',
                };
            case 'TEXT':
                return {
                    enabled: !!(phoneNumberStatus === 'PTVALID' && mobilePhone),
                    warning: phoneNumberStatus !== 'PTVALID' && mobilePhone ? 'Mobile number not verified for Text Message' : !mobilePhone ? 'Mobile phone number not added for the patient.' : '',
                };
            default:
                return { enabled: !!email, warning: !email ? 'Email not added for the patient.' : '' };
        }
    })();

    const validate = () => {
        const next = {};
        if (form.mobileAccess) {
            if (!form.userName.trim()) next.userName = 'Username is required.';
            else if (form.userName.length < 8) next.userName = 'Minimum 8 characters.';
            else if (form.userName.length > 25) next.userName = 'Maximum 25 characters.';
            else if (!USERNAME_RE.test(form.userName)) next.userName = 'Username does not match the rules.';
            if (details.patientPassword && !form.password) next.password = 'Password is required.';
            else if (form.password && !PASSWORD_RE.test(form.password)) next.password = 'Password does not match the rules.';
        }
        return next;
    };

    const buildPayload = (sentCredentials) => {
        const { personId, patientPassword, enableMobileAppAccess, firstName, middleName, lastName, userId, userName } = details;
        const enableMobileAccess = form.mobileAccess ? 'Y' : 'N';
        const patUserName = form.userName.trim();
        const patPassword = form.password.trim();
        let showUserNamePassword = 'N';
        if (userName && patUserName !== userName) showUserNamePassword = 'Y';
        if (patientPassword && patPassword !== patientPassword) showUserNamePassword = 'Y';
        if (!patientPassword && patPassword) showUserNamePassword = 'Y';
        let sendEmailFlag = sentCredentials;
        if (enableMobileAccess !== 'Y') { showUserNamePassword = 'N'; sendEmailFlag = 'N'; }
        if (enableMobileAccess === 'Y' && enableMobileAccess !== enableMobileAppAccess) showUserNamePassword = 'Y';
        return {
            id: patientId,
            personId,
            firstName,
            middleName,
            lastName,
            userId,
            userName: form.mobileAccess && patUserName ? patUserName : details.userName,
            enableMobileAppAccess: enableMobileAccess,
            showUserNamePassword,
            showUserName: showUserNamePassword === 'Y' ? patUserName : null,
            showPassword: showUserNamePassword === 'Y' ? patPassword : null,
            sentCredentials: sendEmailFlag,
            email: details.email,
            credentialSendVia: form.sendVia,
            isUserNameChanged: userName && patUserName !== userName ? 'Y' : 'N',
            isPasswordChanged: (patientPassword === '') || (patientPassword && patPassword !== patientPassword) ? 'Y' : 'N',
        };
    };

    const doSave = async (sentCredentials) => {
        const validation = validate();
        setErrors(validation);
        if (Object.keys(validation).length) return;
        setSaving(true);
        try {
            const payload = buildPayload(sentCredentials);
            const response = await saveMobileAccess(payload);
            if (response?.status === 'success') {
                notifySuccess(sentCredentials === 'Y' ? 'Credentials sent successfully' : 'Patient Mobile App Access updated successfully');
                await refreshPatientDetails(patientId);
                await load();
                setEditing(false);
            }
            else if (response?.status === 'warning') {
                // Server-side duplicate username / old-password rejection.
                const message = typeof response.data === 'string' ? response.data : 'Validation failed.';
                setErrors((prev) => (response.message === 'userName' ? { ...prev, userName: message } : { ...prev, password: message }));
            }
            else if (response?.status === 'failure') {
                notifyError(response.data?.[0]?.errorMessage || 'Failed to update mobile access. Please try again.');
            }
            else notifyError('Failed to update mobile access. Please try again.');
        }
        catch (error) { console.error(error); notifyError('Failed to update mobile access. Please try again.'); }
        finally { setSaving(false); }
    };

    const handleSendCredentials = () => {
        if (details.patientPassword && !form.password) {
            setErrors((prev) => ({ ...prev, password: 'Password is required.' }));
            return;
        }
        const via = form.sendVia === 'EMAIL' ? 'email?' : form.sendVia === 'TEXT' ? 'mobile?' : 'email and mobile?';
        if (window.confirm(`Are you sure about sending the login credentials to patient ${via}`)) doSave('Y');
    };

    if (!details) return <SkeletonViewDetails rows={2} cols={3}/>;

    if (!editing) {
        return (<div className="mx-md-3 my-3">
          <div className="row">
            <div className="col-md-3 col-8">
              <div className="pp-label">Mobile App Access</div>
              <div className="fw-bold">{accessEnabled ? 'Yes' : 'No'}</div>
            </div>
            <div className="col-md-9 col-4 d-flex justify-content-end align-items-start">
              <span role="button" title="Edit Mobile App Access" onClick={openEdit}><LegacyIcon icon="mdi-pencil" style={{ fontSize: 18 }}/></span>
            </div>
          </div>
          {accessEnabled && (<div className="row mt-4">
            <div className="col-md-3 col-6">
              <div className="pp-label">User Name</div>
              <div className="fw-bold">{details.userName || '-'}</div>
            </div>
            <div className="col-md-3 col-6">
              <div className="pp-label">Temporary Password</div>
              <div className="fw-bold">{details.patientPassword || '-'}</div>
            </div>
          </div>)}
        </div>);
    }

    return (<form className="mx-md-3 my-2" autoComplete="off" onSubmit={(e) => { e.preventDefault(); doSave('N'); }} noValidate>
      <div className="row align-items-center">
        <div className="col-md-3 d-flex align-items-center gap-2">
          <input type="checkbox" className="form-check-input" id={`mobile_access_${patientId}`} disabled={!anyPhone}
            checked={form.mobileAccess} onChange={(e) => update({
                mobileAccess: e.target.checked,
                userName: e.target.checked ? details.userName || '' : form.userName,
                password: e.target.checked ? details.patientPassword || '' : form.password,
                email: e.target.checked ? details.email || '' : form.email,
            })}/>
          <label className="form-check-label" htmlFor={`mobile_access_${patientId}`}>Mobile Access</label>
        </div>
        <div className="col-md-8"><label className="mb-0">Note: Phone number is required for mobile access.</label></div>
      </div>

      {form.mobileAccess && (<div className="mt-3">
        <div className="row g-3">
          <div className="col-md-4">
            <label>User Name</label>
            <input type="text" className="form-control" value={form.userName} disabled={details.enableAccessFlag === 'Y'}
              onChange={(e) => { update({ userName: e.target.value }); clearError('userName'); }}/>
            <FieldError message={errors.userName}/>
          </div>
          <div className="col-md-4">
            <label>Temporary Password</label>
            <div className="d-flex gap-2 align-items-start">
              <div className="pp-password-input-group flex-grow-1">
                <input type={showPassword ? 'text' : 'password'} className="form-control" autoComplete="new-password" value={form.password}
                  onChange={(e) => { update({ password: e.target.value }); clearError('password'); }}/>
                <LegacyIcon icon={showPassword ? 'mdi-eye-off' : 'mdi-eye'} className="pp-password-toggle" role="button" onClick={() => setShowPassword((prev) => !prev)}/>
              </div>
              <button type="button" className="btn btn-primary" title={RULES_TOOLTIP}><LegacyIcon icon="fa-question-circle"/></button>
            </div>
            <FieldError message={errors.password}/>
          </div>
          <div className="col-md-4">
            <label>Email</label>
            <input type="text" className="form-control" value={form.email} disabled/>
          </div>
        </div>
        <div className="row g-3 mt-1 align-items-end">
          <div className="col-md-4">
            <label>Send Credentials Through</label>
            <select className="form-select" value={form.sendVia} onChange={(e) => update({ sendVia: e.target.value })}>
              <option value="EMAIL">Email</option>
              <option value="TEXT">Text Message</option>
              <option value="BOTH">Both</option>
            </select>
            {sendState.warning && <p style={{ color: 'orange' }} className="mb-0 mt-1">{sendState.warning}</p>}
          </div>
          <div className="col-md-3">
            <button type="button" className="btn btn-primary border-radius-button" disabled={!sendState.enabled || saving} onClick={handleSendCredentials}>
              {details.enableAccessFlag === 'Y' ? 'Resend Credentials' : 'Send Credentials'}
            </button>
          </div>
        </div>
        {!details.patientPassword && accessEnabled && (
          <p className="mt-3 mb-0">Note: The patient password will be newly generated and it will replace the existing password, if you send the credentials to the email.</p>
        )}
      </div>)}

      <div className="d-flex justify-content-end gap-2 mt-3">
        <button type="button" className="btn btn-primary rounded-pill px-4" disabled={saving}
          onClick={() => { if (window.confirm('Are you sure about cancel mobile access?')) setEditing(false); }}>Cancel</button>
        <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </form>);
};
export default PatientMobileAccess;
