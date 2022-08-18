import "module-alias/register";

import { v4 as uuidv4 } from "uuid";

import { Utils } from "@bitwarden/common/misc/utils";
import { EncString } from "@bitwarden/common/models/domain/encString";
import { SymmetricCryptoKey } from "@bitwarden/common/models/domain/symmetricCryptoKey";
import { ConsoleLogService } from "@bitwarden/common/services/consoleLog.service";
import { EncryptService } from "@bitwarden/common/services/encrypt.service";
import { NodeCryptoFunctionService } from "@bitwarden/node/services/nodeCryptoFunction.service";

import { DecryptedCommandData } from "../../src/models/nativeMessaging/decryptedCommandData";
import { EncryptedMessage } from "../../src/models/nativeMessaging/encryptedMessage";
import { EncryptedMessageResponse } from "../../src/models/nativeMessaging/encryptedMessageResponse";
import { MessageCommon } from "../../src/models/nativeMessaging/messageCommon";
import { UnencryptedMessage } from "../../src/models/nativeMessaging/unencryptedMessage";
import { UnencryptedMessageResponse } from "../../src/models/nativeMessaging/unencryptedMessageResponse";

import IPCService from "./ipcService";
import * as config from "./variables";

type HandshakePayload = {
  status: "success" | "cancelled";
  sharedKey?: string;
};

export default class NativeMessageService {
  private ipcService: IPCService;
  private nodeCryptoFunctionService: NodeCryptoFunctionService;
  private encryptService: EncryptService;

  constructor(private apiVersion: number) {
    console.log("Starting native messaging service");
    this.ipcService = new IPCService(`bitwarden`, (rawMessage) => {
      console.log(`Received unexpected: `, rawMessage);
    });

    this.nodeCryptoFunctionService = new NodeCryptoFunctionService();
    this.encryptService = new EncryptService(
      this.nodeCryptoFunctionService,
      new ConsoleLogService(false),
      false
    );
  }

  // Commands

  async sendHandshake(publicKey: string): Promise<HandshakePayload> {
    const rawResponse = await this.sendUnencryptedMessage({
      command: "bw-handshake",
      payload: {
        publicKey,
      },
    });
    return rawResponse.payload as HandshakePayload;
  }

  async checkStatus(key: string): Promise<DecryptedCommandData> {
    const encryptedCommand = await this.encryptCommandData(
      {
        command: "bw-status",
      },
      key
    );

    const response = await this.sendEncryptedMessage({
      encryptedCommand,
    });

    return this.decryptResponsePayload(response.encryptedPayload, key);
  }

  // Private message sending

  private async sendEncryptedMessage(
    message: Omit<EncryptedMessage, keyof MessageCommon>
  ): Promise<EncryptedMessageResponse> {
    const result = await this.sendMessage(message);
    return result as EncryptedMessageResponse;
  }

  private async sendUnencryptedMessage(
    message: Omit<UnencryptedMessage, keyof MessageCommon>
  ): Promise<UnencryptedMessageResponse> {
    const result = await this.sendMessage(message);
    return result as UnencryptedMessageResponse;
  }

  private async sendMessage(
    message:
      | Omit<UnencryptedMessage, keyof MessageCommon>
      | Omit<EncryptedMessage, keyof MessageCommon>
  ): Promise<EncryptedMessageResponse | UnencryptedMessageResponse> {
    // Attempt to connect before sending any messages. If the connection has already
    // been made, this is a NOOP within the IPCService.
    await this.ipcService.connect();

    const commonFields: MessageCommon = {
      // Create a messageId that can be used as a lookup when we get a response
      messageId: uuidv4(),
      version: this.apiVersion,
    };
    const fullMessage: UnencryptedMessage | EncryptedMessage = {
      ...message,
      ...commonFields,
    };

    console.log(`[NativeMessageService] sendMessage with id: ${fullMessage.messageId}`);

    const response = await this.ipcService.sendMessage(fullMessage);

    console.log(`[NativeMessageService] received response for message: ${fullMessage.messageId}`);

    return response;
  }

  disconnect() {
    this.ipcService.disconnect();
  }

  // Data Encryption
  private async encryptCommandData(
    commandData: DecryptedCommandData,
    key: string
  ): Promise<EncString> {
    const commandDataString = JSON.stringify(commandData);

    const sharedKey = await this.getSharedKeyForKey(key);

    return this.encryptService.encrypt(commandDataString, sharedKey);
  }

  private async decryptResponsePayload(
    payload: EncString,
    key: string
  ): Promise<DecryptedCommandData> {
    const sharedKey = await this.getSharedKeyForKey(key);
    const decrypted = await this.encryptService.decryptToUtf8(payload, sharedKey);

    return JSON.parse(decrypted);
  }

  private async getSharedKeyForKey(key: string): Promise<SymmetricCryptoKey> {
    const dataBuffer = Utils.fromB64ToArray(key).buffer;
    const privKey = Utils.fromB64ToArray(config.testRsaPrivateKey).buffer;

    return new SymmetricCryptoKey(
      await this.nodeCryptoFunctionService.rsaDecrypt(dataBuffer, privKey, "sha1")
    );
  }
}
