import { OrganizationResponse } from "./organization.response";
import {
  BillingSubscriptionResponse,
  BillingSubscriptionUpcomingInvoiceResponse,
} from "./subscription.response";

export class OrganizationSubscriptionResponse extends OrganizationResponse {
  storageName: string;
  storageGb: number;
  subscription: BillingSubscriptionResponse;
  upcomingInvoice: BillingSubscriptionUpcomingInvoiceResponse;
  expiration: string;

  constructor(response: any) {
    super(response);
    this.storageName = this.getResponseProperty("StorageName");
    this.storageGb = this.getResponseProperty("StorageGb");
    const subscription = this.getResponseProperty("Subscription");
    this.subscription = subscription == null ? null : new BillingSubscriptionResponse(subscription);
    const upcomingInvoice = this.getResponseProperty("UpcomingInvoice");
    this.upcomingInvoice =
      upcomingInvoice == null
        ? null
        : new BillingSubscriptionUpcomingInvoiceResponse(upcomingInvoice);
    this.expiration = this.getResponseProperty("Expiration");
  }

  isExpired() {
    return this.expiration != null && new Date(this.expiration) < new Date();
  }
}
