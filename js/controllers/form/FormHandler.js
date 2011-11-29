/**
 * @defgroup js_controllers_form
 */
// Define the namespace.
$.pkp.controllers.form = $.pkp.controllers.form || {};


/**
 * @file js/controllers/form/FormHandler.js
 *
 * Copyright (c) 2000-2011 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * @class FormHandler
 * @ingroup js_controllers_form
 *
 * @brief Abstract form handler.
 */
(function($) {


	/**
	 * @constructor
	 *
	 * @extends $.pkp.classes.Handler
	 *
	 * @param {jQuery} $form the wrapped HTML form element.
	 * @param {Object} options options to be passed
	 *  into the validator plug-in.
	 */
	$.pkp.controllers.form.FormHandler = function($form, options) {
		this.parent($form, options);

		// Check whether we really got a form.
		if (!$form.is('form')) {
			throw Error(['A form handler controller can only be bound',
				' to an HTML form element!'].join(''));
		}

		// Transform all form buttons with jQueryUI.
		$('.button', $form).button();

		// Activate and configure the validation plug-in.
		if (options.submitHandler) {
			this.callerSubmitHandler_ = options.submitHandler;
		}

		// Set the redirect-to URL for the cancel button (if there is one).
		if (options.cancelRedirectUrl) {
			this.cancelRedirectUrl_ = options.cancelRedirectUrl;
		}

		// Determine if the data changed message has been overridden
		// with an options element. If not, use the default provided by
		// the Application. Orignal Locale key: form.dataHasChanged.
		// @see PKPApplication::getJSLocaleKeys
		if (options.formDataChangedMessage) {
			this.formDataChangedMessage_ = options.formDataChangedMessage;
		} else {
			this.formDataChangedMessage_ = $.pkp.locale.form_dataHasChanged;
		}

		// Bind the pageUnloadHandler_ method to the DOM so it is
		// called. We bind to both events because some browsers don't
		// trigger unload all the time. The handler will only fire once.
		$(window).bind('beforeunload unload',
				this.callbackWrapper(this.pageUnloadHandler_));

		var validator = $form.validate({
			errorClass: 'error',
			highlight: function(element, errorClass) {
				$(element).parent().parent().addClass(errorClass);
			},
			unhighlight: function(element, errorClass) {
				$(element).parent().parent().removeClass(errorClass);
			},
			submitHandler: this.callbackWrapper(this.submitHandler_),
			showErrors: this.callbackWrapper(this.formChange)
		});

		// Activate the cancel button (if present).
		$('#cancelFormButton', $form).click(this.callbackWrapper(this.cancelForm));

		// Initial form validation.
		if (validator.checkForm()) {
			this.trigger('formValid');
		} else {
			this.trigger('formInvalid');
		}
	};
	$.pkp.classes.Helper.inherits(
			$.pkp.controllers.form.FormHandler,
			$.pkp.classes.Handler);


	//
	// Private properties
	//
	/**
	 * If provided, the caller's submit handler, which will be
	 * triggered to save the form.
	 * @private
	 * @type {Function}
	 */
	$.pkp.controllers.form.FormHandler.prototype.callerSubmitHandler_ = null;


	/**
	 * If provided, the URL to redirect to when the cancel button is clicked
	 * @private
	 * @type {String}
	 */
	$.pkp.controllers.form.FormHandler.prototype.cancelRedirectUrl_ = null;


	/**
	 * A state variable to determine if data has changed on the form.
	 * For 'cancel' and 'page unload' warnings.
	 * @private
	 * @type {Boolean}
	 */
	$.pkp.controllers.form.FormHandler.prototype.formDataChanged_ = false;


	/**
	 * A state variable to store the message to display when the page is
	 * unloaded with unsaved data.
	 * @private
	 * @type {String}
	 */
	$.pkp.controllers.form.FormHandler.prototype.formDataChangedMessage_ = null;


	//
	// Public methods
	//
	/**
	 * Internal callback called whenever the form changes.
	 *
	 * @param {Object} validator The validator plug-in.
	 * @param {Object} errorMap An associative list that attributes
	 *  element names to error messages.
	 * @param {Array} errorList An array with objects that contains
	 *  error messages and the corresponding HTMLElements.
	 */
	$.pkp.controllers.form.FormHandler.prototype.formChange =
			function(validator, errorMap, errorList) {

		// update the state flag to indicate that the form data has changed
		this.formDataChanged_ = true;

		// Show errors generated by the form change.
		validator.defaultShowErrors();

		// Emit validation events.
		if (validator.checkForm()) {
			// Trigger a "form valid" event.
			this.trigger('formValid');
		} else {
			// Trigger a "form invalid" event.
			this.trigger('formInvalid');
		}
	};


	/**
	 * Internal callback called to cancel the form.
	 *
	 * @param {HTMLElement} cancelButton The cancel button.
	 * @param {Event} event The event that triggered the
	 *  cancel button.
	 * @return {boolean} false.
	 */
	$.pkp.controllers.form.FormHandler.prototype.cancelForm =
			function(cancelButton, event) {

		// Trigger the "form canceled" event.
		this.trigger('formCanceled');
		return false;
	};


	//
	// Private Methods
	//
	/**
	 * Internal callback called after form validation to handle form
	 * submission.
	 *
	 * @private
	 *
	 * @param {Object} validator The validator plug-in.
	 * @param {HTMLElement} formElement The wrapped HTML form.
	 * @return {Function|boolean} a callback method.
	 */
	$.pkp.controllers.form.FormHandler.prototype.submitHandler_ =
			function(validator, formElement) {

		if (typeof tinyMCE !== 'undefined') {
			tinyMCE.triggerSave();
		}

		// unbind the 'unsaved changes' event handler since the form is
		// being submitted
		$(window).unbind('unload beforeunload');

		// Notify any nested formWidgets of the submit action.
		var formSubmitEvent = new $.Event('formSubmitRequested');
		$(formElement).find('.formWidget').trigger(formSubmitEvent);

		// If the default behavior was prevented for any reason, stop.
		if (formSubmitEvent.isDefaultPrevented()) {
			return false;
		}

		if (this.callerSubmitHandler_ !== null) {
			// A form submission handler (e.g. Ajax) was provided. Use it.
			return this.callbackWrapper(this.callerSubmitHandler_).
					call(validator, formElement);
		} else {
			// No form submission handler was provided. Use the usual method.

			// FIXME: Is there a better way? This is used to invoke
			// the default form submission code. (Necessary to
			// avoid an infinite loop.)
			validator.settings.submitHandler = null;

			this.getHtmlElement().submit();
		}
	};


	/**
	 * Internal callback called upon page unload.
	 *
	 * @private
	 *
	 * @param {Object} object The validator plug-in.
	 * @param {Event} event The wrapped HTML form.
	 * @return {string?} the warning message string, if needed.
	 */
	$.pkp.controllers.form.FormHandler.prototype.pageUnloadHandler_ =
			function(object, event) {

		// if this function returns anything other than true, a
		// confirmation dialog is shown. Optionally, we could set a
		// locale key for an addtional message to display on the modal.
		if (this.formDataChanged_) {
			return this.formDataChangedMessage_;
		}
	};
/** @param {jQuery} $ jQuery closure. */
})(jQuery);
