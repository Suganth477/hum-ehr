import { useState } from 'react';
// Strip emoji-range characters (mirrors the legacy common.utility.js behaviour).
const EMOJI_REGEX = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/gi;
export const useEhrNativeInteractions = (initialMaxLength = 1000) => {
	const [passwordVisible, setPasswordVisible] = useState(false);
	const togglePasswordVisibility = () => setPasswordVisible((prev) => !prev);
	const [notesText, setNotesText] = useState('');
	const [maxLength, setMaxLength] = useState(initialMaxLength);
	const handleNotesChange = (e) => {
		setNotesText(e.target.value.replace(EMOJI_REGEX, ''));
	};
	const [infoBannerVisible, setInfoBannerVisible] = useState(true);
	const dismissInfoBanner = () => {
		setInfoBannerVisible(false);
		document.body.classList.add('app-info-hided');
	};
	const [sidebarExpanded, setSidebarExpanded] = useState(false);
	const toggleSidebarLayout = () => {
		setSidebarExpanded((prev) => {
			const next = !prev;
			document.body.classList.toggle('expanded-view', next);
			return next;
		});
	};
	const [viewMoreDetails, setViewMoreDetails] = useState(false);
	const toggleDetailsPane = () => setViewMoreDetails((prev) => !prev);
	const scrollToFirstValidationError = (formSelectorId) => {
		const node = document.querySelector(`${formSelectorId} .error, ${formSelectorId} .is-invalid`);
		node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	};
	return {
		passwordVisible,
		togglePasswordVisibility,
		notesText,
		setNotesText,
		maxLength,
		setMaxLength,
		handleNotesChange,
		infoBannerVisible,
		dismissInfoBanner,
		sidebarExpanded,
		toggleSidebarLayout,
		viewMoreDetails,
		toggleDetailsPane,
		scrollToFirstValidationError,
	};
};
