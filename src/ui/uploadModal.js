/*
 * ============================================================
 *  ZCheck Verifier Bot
 *  Built By Arsh
 * ============================================================
 */

const {
  FileUploadBuilder,
  LabelBuilder,
  ModalBuilder,
} = require('discord.js');
const {
  SCREENSHOT_UPLOAD_ID,
  VERIFY_MODAL_ID,
} = require('../constants');

function buildUploadModal(handle) {
  return new ModalBuilder()
    .setCustomId(VERIFY_MODAL_ID)
    .setTitle('ZCheck \u00B7 Upload Screenshot')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Upload Your Screen Shot')
        .setDescription(`Upload a screenshot showing ${handle} and the Subscribed button.`)
        .setFileUploadComponent(
          new FileUploadBuilder()
            .setCustomId(SCREENSHOT_UPLOAD_ID)
            .setRequired(true)
            .setMinValues(1)
            .setMaxValues(1),
        ),
    );
}

module.exports = {
  buildUploadModal,
};
