/**
 * Role codes the legacy JSP branched on (`WebServiceUtil.SUPER_ADMIN_ROLE_CODE` /
 * `CARE_ADMIN_ROLE_CODE`, compared against `userLoginDetails.getUserRoleCode()`).
 * Kept in one place so every screen that reproduces a legacy role gate uses the
 * same list — the JWT `roleCode` claim carries the value at runtime.
 */
export const SUPER_ADMIN_ROLE_CODE = 'CMSSUPEADM';
export const CARE_ADMIN_ROLE_CODE = 'CMSCLINADM';

/**
 * Roles the legacy hides the Message Center **chat** from — both the header
 * quick-access chat icon (`ehr-layout.jsp` wraps `ehr-chat.jsp` in
 * `if (!SUPER_ADMIN && !CARE_ADMIN)`) and the Message Center's chat tab.
 */
export const CHAT_HIDDEN_ROLES = [SUPER_ADMIN_ROLE_CODE, CARE_ADMIN_ROLE_CODE];

/** True when the logged-in role must not see the chat surfaces. */
export const isChatHiddenRole = (roleCode) => CHAT_HIDDEN_ROLES.includes(roleCode);
