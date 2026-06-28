import { App, Modal, Notice, Setting } from 'obsidian';

/**
 * Asks for a new YAML prefix and confirms migrating all notes' Ghost frontmatter
 * keys from the current prefix to the new one.
 */
export class MigratePrefixModal extends Modal {
	private currentPrefix: string;
	private newPrefix: string;
	private onMigrate: (newPrefix: string) => void | Promise<void>;

	constructor(app: App, currentPrefix: string, onMigrate: (newPrefix: string) => void | Promise<void>) {
		super(app);
		this.currentPrefix = currentPrefix;
		this.newPrefix = currentPrefix === 'g_' ? 'ghost_' : 'g_';
		this.onMigrate = onMigrate;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h3', { text: 'Migrate ghost property prefix' });
		contentEl.createEl('p', {
			text: `Rename every frontmatter key starting with "${this.currentPrefix}" to the new prefix, across all notes in the vault, and update the plugin setting. Values are preserved.`
		});

		new Setting(contentEl)
			.setName('New prefix')
			.setDesc('For example, g_')
			.addText(t => t
				.setValue(this.newPrefix)
				.onChange(v => this.newPrefix = v));

		new Setting(contentEl)
			.addButton(b => b.setButtonText('Cancel').onClick(() => this.close()))
			.addButton(b => b.setButtonText('Migrate').setCta().onClick(() => {
				const np = this.newPrefix.trim();
				if (!np) { new Notice('Enter a prefix'); return; }
				if (np === this.currentPrefix) { new Notice('Enter a different prefix'); return; }
				this.close();
				void this.onMigrate(np);
			}));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
