import { useEffect, useMemo, useState } from 'react';
import {
    getPatientDetails, refreshPatientDetails, fetchCommunicationMethods, savePhoneInformation,
    buildPhoneInformationSavePayload, sendPhoneVerificationCode, validatePhoneOtp,
    validateUniquePatientField, formatPhoneInput,
} from '../../../services/patientProfileService';
import patientCache from '../../../utils/patientCache';
import { SkeletonViewDetails } from '../../../components/common/ContentLoader';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { useNotify } from '../../../context/NotificationContext';

const FieldError = ({ message }) => (message ? <div className="small text-danger mt-1">{message}</div> : null);
const PHONE_RE = /^\(\d{3}\)-\d{3}-\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHONES = [
    { key: 'mobilePhone', invalidKey: 'invalidMobileNumber', label: 'Mobile Phone', comm: 'CMPH', requiredMsg: 'Please enter a Mobile phone number.', invalidMsg: 'Mobile phone number is invalid.' },
    { key: 'homePhone', invalidKey: 'invalidHomeNumber', label: 'Home Phone', comm: 'CHPH', requiredMsg: 'Please enter a Home phone number.', invalidMsg: 'Home phone is invalid.' },
    { key: 'workPhone', invalidKey: 'invalidWorkNumber', label: 'Work Phone', comm: 'CWPH', requiredMsg: 'Please enter a Work phone number.', invalidMsg: 'Work phone is invalid.' },
    { key: 'otherPhone', invalidKey: 'invalidOtherNumber', label: 'Other Phone', comm: 'COPH', requiredMsg: 'Please enter an Other phone number.', invalidMsg: 'Other phone is invalid.' },
];

/**
 * Communication Information edit (legacy patient-phone-information-edit):
 * phones with invalid-number flags and duplicate checks, primary/secondary
 * communication with mutual exclusion, email + confirm, and the text-message
 * setup block (OTP verification or verbal consent, per facility setup).
 */
const PatientPhoneInformationEdit = ({ patientId, onClose }) => {
    const { notifySuccess, notifyError } = useNotify();
    const [details, setDetails] = useState(null);
    const [commMethods, setCommMethods] = useState([]);
    const [form, setForm] = useState(null);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [otp, setOtp] = useState({ value: '', error: '', sent: false, verifyEnabled: false, sendEnabled: false, inputEnabled: false, resendLabel: 'Send Code' });

    const enrolledProductCount = (patientCache.get(`${patientId}_subscribedProducts`) || []).length;

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const [patientDetails, methods] = await Promise.all([getPatientDetails(patientId), fetchCommunicationMethods()]);
                if (ignore) return;
                setDetails(patientDetails);
                setCommMethods(methods);
                const consentEnabled = patientDetails.smsConfiguration === 'Y'
                    && (patientDetails.textMessageConsent === 'Y' || patientDetails.phoneNumberStatus === 'PTVALID');
                setForm({
                    mobilePhone: patientDetails.mobilePhone || '',
                    homePhone: patientDetails.homePhone || '',
                    workPhone: patientDetails.workPhone || '',
                    otherPhone: patientDetails.otherPhone || '',
                    faxNumber: patientDetails.faxPhone || '',
                    email: patientDetails.email || '',
                    confirmEmail: patientDetails.email || '',
                    primaryCommunication: patientDetails.primaryCommunication || '',
                    secondaryCommunication: patientDetails.secondaryCommunication || '',
                    invalidMobileNumber: patientDetails.mobilePhoneInvalidFlag === 'Y' ? 'Y' : 'N',
                    invalidHomeNumber: patientDetails.pagerPhoneInvalidFlag === 'Y' ? 'Y' : 'N',
                    invalidWorkNumber: patientDetails.workPhoneInvalidFlag === 'Y' ? 'Y' : 'N',
                    invalidOtherNumber: patientDetails.otherPhoneInvalidFlag === 'Y' ? 'Y' : 'N',
                    patientCallRecordingPreference: patientDetails.patientCallRecordingPreference === 'Y' ? 'Y' : 'N',
                    textMessageConsent: consentEnabled ? 'Y' : 'N',
                    disableTextMessage: !consentEnabled,
                    consentChecked: patientDetails.verificationType === 'VERBVERIF' && patientDetails.textMessageConsent === 'Y',
                });
                // OTP block initial state (legacy enableOTPVerificationSetupBasedOnVerificationType)
                const otpEligible = patientDetails.mobilePhone && patientDetails.mobilePhoneInvalidFlag !== 'Y'
                    && patientDetails.smsConfiguration === 'Y' && (patientCache.get(`${patientId}_subscribedProducts`) || []).length !== 0;
                if (patientDetails.verificationType === 'VERIFYCODE' || patientDetails.verificationType === undefined || patientDetails.verificationType === null) {
                    if (otpEligible && patientDetails.phoneNumberStatus !== 'PTVALID') {
                        const isVerifCode = patientDetails.phoneNumberStatus === 'VERIFCODE';
                        setOtp((prev) => ({
                            ...prev,
                            sendEnabled: true,
                            inputEnabled: patientDetails.phoneNumberStatus !== 'UNVERIFIED',
                            resendLabel: isVerifCode ? 'Resend Code' : 'Send Code',
                            sent: isVerifCode,
                        }));
                    }
                }
            }
            catch (error) { console.error('Failed to load phone information form.', error); notifyError('Failed to fetch patient communication details.'); }
        })();
        return () => { ignore = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId]);

    const update = (patch) => { setForm((prev) => ({ ...prev, ...patch })); setDirty(true); };
    const clearError = (key) => setErrors((prev) => { if (!prev[key]) return prev; const next = { ...prev }; delete next[key]; return next; });

    const showConsentBlock = details?.verificationType === 'VERBVERIF';
    const showOtpBlock = !showConsentBlock;
    const optedOut = details?.phoneNumberStatus === 'PTOPTOUT' && details?.patientOptOutDate;

    const primaryOptions = useMemo(() => commMethods.filter((method) => method.code !== 'CPNO' && method.code !== 'CEMA' && method.code !== form?.secondaryCommunication), [commMethods, form?.secondaryCommunication]);
    const secondaryOptions = useMemo(() => commMethods.filter((method) => method.code !== 'CPNO' && method.code !== form?.primaryCommunication), [commMethods, form?.primaryCommunication]);

    const handlePhoneChange = (phone, rawValue) => {
        const value = formatPhoneInput(rawValue);
        const patch = { [phone.key]: value };
        // A re-typed valid number clears its invalid flag (legacy onChangePhoneNumbers).
        if (value && PHONE_RE.test(value)) patch[phone.invalidKey] = 'N';
        if (phone.key === 'mobilePhone') {
            // Mobile change locks the OTP block until re-verification.
            setOtp((prev) => ({ ...prev, sendEnabled: false, inputEnabled: false, verifyEnabled: false }));
            patch.textMessageConsent = details.mobilePhone === value && details.mobilePhoneInvalidFlag === (form[phone.invalidKey] || 'N') ? form.textMessageConsent : 'N';
            patch.consentChecked = details.mobilePhone === value && form.consentChecked;
        }
        update(patch);
        clearError(phone.key);
    };

    const handleInvalidToggle = (phone, checked) => {
        const patch = { [phone.invalidKey]: checked ? 'Y' : 'N' };
        if (phone.key === 'mobilePhone') {
            setOtp((prev) => ({ ...prev, sendEnabled: false, inputEnabled: false, verifyEnabled: false, error: '' }));
            const consentValue = details.mobilePhone === form.mobilePhone && details.mobilePhoneInvalidFlag === (checked ? 'Y' : 'N');
            patch.consentChecked = consentValue && form.consentChecked;
            patch.textMessageConsent = consentValue ? form.textMessageConsent : 'N';
        }
        update(patch);
    };

    const uniqueCheck = async (fieldName, value, errorKey, fallback) => {
        if (!value) return;
        try {
            const response = await validateUniquePatientField(fieldName, value, patientId);
            if (response?.status && response.status !== 'success') {
                const message = response.data?.[0]?.errorMessage || response.data?.errorMessage
                    || (typeof response.data === 'string' ? response.data : fallback);
                setErrors((prev) => ({ ...prev, [errorKey]: message }));
            }
        }
        catch (error) { console.error('Unique validation failed.', error); }
    };

    const sendCode = async () => {
        if (!form.mobilePhone) { notifyError('Mobile number is required for SMS verification.'); return; }
        const question = optedOut
            ? `Patient opt-out text message service on ${details.patientOptOutDate}. Would you still like to proceed?`
            : 'Are you sure about sending the code?';
        if (!window.confirm(question)) return;
        try {
            const response = await sendPhoneVerificationCode({ number: form.mobilePhone, patientId, isResend: otp.sent });
            if (response?.status === 'success') {
                setOtp((prev) => ({ ...prev, sent: true, resendLabel: 'Resend Code', inputEnabled: true, value: '', error: '' }));
                notifySuccess('Verification Code has been sent to the patient mobile number.');
            }
            else notifyError('Should be a valid mobile number within US');
        }
        catch (error) { console.error(error); notifyError('Failed to sent verification code to the patient mobile number.'); }
    };

    const verifyCode = async () => {
        if (!/^([a-zA-Z0-9]{6})$/.test(otp.value)) {
            setOtp((prev) => ({ ...prev, error: 'OTP must be 6 characters.' }));
            return;
        }
        try {
            const response = await validatePhoneOtp({ otp: otp.value, patientId });
            if (response?.status === 'success') {
                if (response.data === 'VALID') {
                    setOtp((prev) => ({ ...prev, value: '', error: '', sendEnabled: false, inputEnabled: false, verifyEnabled: false }));
                    notifySuccess('Patient mobile number verified successfully.');
                    await refreshPatientDetails(patientId);
                    onClose(true);
                }
                else setOtp((prev) => ({ ...prev, value: '', error: 'Invalid Verification Code', verifyEnabled: false }));
            }
            else notifyError('Failed to verify the mobile number.');
        }
        catch (error) { console.error(error); notifyError('Failed to verify the mobile number.'); }
    };

    const handleConsentCheck = (checked) => {
        if (!checked) { update({ consentChecked: false, textMessageConsent: 'N' }); return; }
        const optOutNote = optedOut ? `\nNote: The patient opted out of the text message service on ${details.patientOptOutDate}.` : '';
        const fullName = `${details.firstName || ''}${details.middleName ? ` ${details.middleName}` : ''} ${details.lastName || ''}`.trim();
        const agreed = window.confirm(`Text Message Consent Confirmation\n\nI called the phone number belonging to ${fullName} and verified the phone number, and also received consent to start sending text messages.${optOutNote}\n\nSelect OK to agree.`);
        if (agreed) update({ consentChecked: true, textMessageConsent: 'Y', disableTextMessage: false });
    };

    const validate = () => {
        const next = {};
        PHONES.forEach((phone) => {
            const value = form[phone.key];
            const requiredByComm = form.primaryCommunication === phone.comm || form.secondaryCommunication === phone.comm;
            const mobileAppRequires = phone.key === 'mobilePhone' && details.enableMobileAppAccess === 'Y'
                && !form.homePhone && !form.workPhone && !form.otherPhone;
            if (!value && (requiredByComm || mobileAppRequires)) next[phone.key] = phone.requiredMsg;
            else if (value && !PHONE_RE.test(value)) next[phone.key] = phone.invalidMsg;
            else if (value && PHONES.some((other) => other.key !== phone.key && form[other.key] && form[other.key] === value)) next[phone.key] = 'Phone numbers should not be the same.';
        });
        if (form.faxNumber && !PHONE_RE.test(form.faxNumber)) next.faxNumber = 'Please enter valid fax number.';
        if (form.email) {
            if (form.email.length < 6) next.email = 'Minimum 6 characters.';
            else if (form.email.length > 50) next.email = 'Maximum 50 characters.';
            else if (!EMAIL_RE.test(form.email)) next.email = 'Email is invalid.';
        }
        else if (form.secondaryCommunication === 'CEMA') next.email = 'Please enter an Email address.';
        if (form.confirmEmail !== form.email) next.confirmEmail = 'Emails do not match.';
        const anyPhone = form.mobilePhone || form.homePhone || form.workPhone || form.otherPhone;
        if (anyPhone && !form.primaryCommunication) next.primaryCommunication = 'Please select a primary communication.';
        return next;
    };

    const handleSave = async () => {
        const validation = validate();
        setErrors(validation);
        if (Object.keys(validation).length) return;
        setSaving(true);
        try {
            const payload = buildPhoneInformationSavePayload({ patientId, patientDetails: details, form });
            const response = await savePhoneInformation(payload);
            if (response?.status === 'success') {
                notifySuccess('Patient contact information updated successfully');
                await refreshPatientDetails(patientId);
                onClose(true);
            }
            else notifyError('Failed to update patient contact information. Please try again.');
        }
        catch (error) { console.error('Failed to save contact information.', error); notifyError('Failed to update patient contact information. Please try again.'); }
        finally { setSaving(false); }
    };

    const handleCancel = () => {
        if (!dirty || window.confirm('Are you sure you want to cancel?')) onClose(false);
    };

    if (!form) return <SkeletonViewDetails rows={3} cols={4}/>;

    const phoneColor = (phone) => (form[phone.key] ? (form[phone.invalidKey] === 'Y' ? 'red' : 'green') : undefined);
    const consentDisabled = form.disableTextMessage
        || !(form.mobilePhone && form.invalidMobileNumber !== 'Y' && enrolledProductCount !== 0 && details.smsConfiguration === 'Y')
        || (details.textMessageConsent === 'Y' && details.verificationType === 'VERBVERIF');

    return (<form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSave(); }} noValidate>
      <div className="pp-detail-card p-2 m-md-2">
        <div className="row g-3">
          <div className="col-md-4">
            <label>Primary Communication</label>
            <select className="form-select" value={form.primaryCommunication} onChange={(e) => { update({ primaryCommunication: e.target.value }); clearError('primaryCommunication'); }}>
              <option value="">Select Primary Communication</option>
              {primaryOptions.map((method) => <option key={method.code} value={method.code}>{method.description}</option>)}
            </select>
            <FieldError message={errors.primaryCommunication}/>
          </div>
          <div className="col-md-4">
            <label>Secondary Communication</label>
            <select className="form-select" value={form.secondaryCommunication} onChange={(e) => update({ secondaryCommunication: e.target.value })}>
              <option value="">Select Secondary Communication</option>
              {secondaryOptions.map((method) => <option key={method.code} value={method.code}>{method.description}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="fw-bold ms-2 mt-3 mb-1"><LegacyIcon icon="fa-phone" className="me-2"/>Patient Contact</div>
      <div className="pp-detail-card p-2 ms-md-4">
        <div className="row g-3">
          {PHONES.map((phone) => (
            <div className="col-md-3" key={phone.key}>
              <div className="d-flex justify-content-between align-items-center">
                <label className="mb-0">{phone.label}</label>
                <label className="mb-0 small d-flex align-items-center">
                  <input type="checkbox" className="me-1" checked={form[phone.invalidKey] === 'Y'} disabled={!form[phone.key]}
                    onChange={(e) => handleInvalidToggle(phone, e.target.checked)}/>
                  Invalid number
                </label>
              </div>
              <input type="text" className="form-control" style={{ color: phoneColor(phone) }} value={form[phone.key]}
                onChange={(e) => handlePhoneChange(phone, e.target.value)}
                onBlur={() => { if (phone.key === 'mobilePhone' && form.mobilePhone && PHONE_RE.test(form.mobilePhone) && form.mobilePhone !== details.mobilePhone) uniqueCheck('mobile', form.mobilePhone, 'mobilePhone', 'Mobile number already exists.'); }}/>
              <FieldError message={errors[phone.key]}/>
            </div>
          ))}
        </div>
        <div className="row g-3 mt-1">
          <div className="col-md-4">
            <label>Email</label>
            <input type="text" className="form-control" maxLength={50} value={form.email}
              onChange={(e) => { update({ email: e.target.value }); clearError('email'); }}
              onBlur={() => { if (form.email && EMAIL_RE.test(form.email) && form.email !== details.email) uniqueCheck('email', form.email, 'email', 'Email already exists.'); }}/>
            <FieldError message={errors.email}/>
          </div>
          <div className="col-md-4">
            <label>Confirm Email</label>
            <input type="text" className="form-control" maxLength={50} value={form.confirmEmail} onChange={(e) => { update({ confirmEmail: e.target.value }); clearError('confirmEmail'); }}/>
            <FieldError message={errors.confirmEmail}/>
          </div>
          <div className="col-md-4">
            <label>Fax</label>
            <input type="text" className="form-control" value={form.faxNumber} onChange={(e) => { update({ faxNumber: formatPhoneInput(e.target.value) }); clearError('faxNumber'); }}/>
            <FieldError message={errors.faxNumber}/>
          </div>
        </div>
      </div>

      <div className="fw-bold ms-2 mt-3 mb-1"><LegacyIcon icon="fa-message" className="me-2"/>Text Message</div>
      <div className="pp-detail-card p-2 ms-md-4">
        {optedOut && <p className="text-danger small mb-2">The Patient Chose to opt out from text message.</p>}
        <div className="row g-3 align-items-end">
          {showConsentBlock && (
            <div className="col-md-4">
              <label className="d-flex align-items-center mb-0">
                <input type="checkbox" className="me-2" checked={form.consentChecked} disabled={consentDisabled} onChange={(e) => handleConsentCheck(e.target.checked)}/>
                Text Message Consent
              </label>
            </div>
          )}
          {showOtpBlock && (<>
            <div className="col-md-4">
              <label>Enter Verification Code</label>
              <input type="text" className="form-control" value={otp.value} disabled={!otp.inputEnabled}
                onChange={(e) => setOtp((prev) => ({ ...prev, value: e.target.value, error: '', verifyEnabled: /^([a-zA-Z0-9]{6})$/.test(e.target.value) }))}/>
              {otp.error && <div className="small text-danger mt-1">{otp.error}</div>}
            </div>
            <div className="col-md-4 d-flex gap-2" style={{ marginBottom: 2 }}>
              <button type="button" className="btn btn-primary rounded-pill" disabled={!otp.verifyEnabled} onClick={verifyCode}>Verify Code</button>
              <button type="button" className="btn btn-primary rounded-pill" disabled={!otp.sendEnabled || otp.verifyEnabled} onClick={sendCode}>{otp.resendLabel}</button>
            </div>
          </>)}
          <div className="col-md-4">
            <label className="d-flex align-items-center mb-0">
              <input type="checkbox" className="me-2" checked={form.disableTextMessage}
                disabled={!(details.smsConfiguration === 'Y' && (details.textMessageConsent === 'Y' || details.phoneNumberStatus === 'PTVALID'))}
                onChange={(e) => update({ disableTextMessage: e.target.checked, textMessageConsent: 'N', consentChecked: e.target.checked ? false : form.consentChecked })}/>
              Disable Text Message Feature
            </label>
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-end gap-2 mt-3 me-2">
        <button type="button" className="btn btn-primary rounded-pill px-4" disabled={saving} onClick={handleCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary rounded-pill px-4 bs-modal-save-btn" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </form>);
};
export default PatientPhoneInformationEdit;
