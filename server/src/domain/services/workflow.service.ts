import { Workflow } from '../models';
import { WorkflowTriggerEvent, WorkflowActionType } from '../../shared/types';

export class WorkflowService {
  async seedDefaultWorkflows(tenantId: string): Promise<void> {
    const defaultWorkflows = [
      {
        tenantId,
        name: 'Auto-create ticket on urgent message',
        description: 'Automatically creates a high-priority ticket when a message contains urgent keywords',
        triggerEvent: 'message_received' as WorkflowTriggerEvent,
        conditions: { messageContains: ['urgent', 'emergency', 'asap'] },
        actions: [
          {
            actionType: 'create_ticket' as WorkflowActionType,
            config: { priority: 'high' }
          }
        ],
        isActive: true,
        isDefault: true,
      },
      {
        tenantId,
        name: 'Auto-reply for business hours',
        description: 'Sends an automatic reply during business hours',
        triggerEvent: 'message_received' as WorkflowTriggerEvent,
        conditions: {},
        actions: [
          {
            actionType: 'send_auto_reply' as WorkflowActionType,
            config: { message: 'Thank you for contacting us. We will respond shortly.' }
          }
        ],
        isActive: true,
        isDefault: true,
      },
    ];

    for (const workflowData of defaultWorkflows) {
      await Workflow.findOneAndUpdate(
        { tenantId, name: workflowData.name },
        workflowData,
        { upsert: true, new: true }
      );
    }
  }

  async getWorkflowsByTenant(tenantId: string): Promise<any[]> {
    return await Workflow.find({ tenantId }).sort({ createdAt: -1 });
  }

  async getWorkflowById(workflowId: string, tenantId: string): Promise<any | null> {
    return await Workflow.findOne({ workflowId, tenantId });
  }

  async createWorkflow(workflowData: any): Promise<any> {
    const workflow = new Workflow(workflowData);
    return await workflow.save();
  }

  async updateWorkflow(workflowId: string, tenantId: string, updateData: any): Promise<any | null> {
    return await Workflow.findOneAndUpdate(
      { workflowId, tenantId },
      updateData,
      { new: true }
    );
  }

  async deleteWorkflow(workflowId: string, tenantId: string): Promise<boolean> {
    const result = await Workflow.deleteOne({ workflowId, tenantId });
    return result.deletedCount === 1;
  }

  async toggleWorkflowStatus(workflowId: string, tenantId: string): Promise<any | null> {
    const workflow = await Workflow.findOne({ workflowId, tenantId });
    if (!workflow) return null;

    workflow.isActive = !workflow.isActive;
    return await workflow.save();
  }

  async executeWorkflowActions(
    event: string, 
    tenantId: string, 
    context: any
  ): Promise<void> {
    const workflows = await Workflow.find({
      tenantId,
      triggerEvent: event,
      isActive: true
    });

    for (const workflow of workflows) {
      // Check conditions
      if (workflow.conditions && !this.checkConditions(workflow.conditions, context)) {
        continue;
      }

      // Execute actions
      for (const action of workflow.actions) {
        await this.executeAction(action.actionType, action.config, context);
      }
    }
  }

  private checkConditions(conditions: any, context: any): boolean {
    if (!conditions) return true;

    if (conditions.messageContains) {
      const keywords = Array.isArray(conditions.messageContains) 
        ? conditions.messageContains 
        : [conditions.messageContains];
      const messageContent = (context.msg?.message?.conversation || '').toLowerCase();
      
      return keywords.some((keyword: string) => 
        messageContent.includes(keyword.toLowerCase())
      );
    }

    return true;
  }

  private async executeAction(
    actionType: WorkflowActionType, 
    config: any, 
    context: any
  ): Promise<void> {
    switch (actionType) {
      case 'create_ticket':
        // Logic to create a ticket would go here
        console.log('Creating ticket with config:', config);
        break;
      case 'assign_ticket':
        // Logic to assign a ticket
        console.log('Assigning ticket with config:', config);
        break;
      case 'send_auto_reply':
        // Logic to send auto-reply
        console.log('Sending auto-reply:', config.message);
        break;
      case 'add_tag':
        // Logic to add tag to contact
        console.log('Adding tag:', config.tag);
        break;
    }
  }
}
