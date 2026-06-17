import { useState, useEffect } from "react";

export const useEhrNativeInteractions = (initialMaxLength = 1000) => {
	// 1. Password visibility toggle states
	const [passwordVisible, setPasswordVisible] = useState(false);
	const togglePasswordVisibility = () => setPasswordVisible((prev) => !prev);

	// 2. Character counter length tracking mappings
	const [notesText, setNotesText] = useState("");
	const [maxLength, setMaxLength] = useState(initialMaxLength);

	const handleNotesChange = (e) => {
		const value = e.target.value;
		// Strip emojis exactly as requested in line 113 of common.utility.js
		const emojiRegex =
			/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/gi;
		const cleanValue = value.replace(emojiRegex, "");
		setNotesText(cleanValue);
	};

	// 3. Application informational top banner dismissal state
	const [infoBannerVisible, setInfoBannerVisible] = useState(true);
	const dismissInfoBanner = () => {
		setInfoBannerVisible(false);
		document.body.classList.add("app-info-hided");
	};

	// 4. Sidebar navigation panel display layout configurations
	const [sidebarExpanded, setSidebarExpanded] = useState(false);
	const toggleSidebarLayout = () => {
		setSidebarExpanded((prev) => {
			const nextState = !prev;
			if (nextState) {
				document.body.classList.add("expanded-view");
			} else {
				document.body.classList.remove("expanded-view");
			}
			return nextState;
		});
	};

	// 5. Section visibility toggles for collapsing/expanding detail panels
	const [viewMoreDetails, setViewMoreDetails] = useState(false);
	const toggleDetailsPane = () => setViewMoreDetails((prev) => !prev);

	// 6. Smooth scrolling engine for target validation errors
	const scrollToFirstValidationError = (formSelectorId) => {
		const errorNode = document.querySelector(
			`${formSelectorId} .error, ${formSelectorId} .is-invalid`,
		);
		if (errorNode) {
			errorNode.scrollIntoView({ behavior: "smooth", block: "center" });
		}
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
