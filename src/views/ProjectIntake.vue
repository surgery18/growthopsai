<template>
	<div>
		<div
			v-if="isSubmitting"
			class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
			<div
				class="bg-[#12141A] border border-white/10 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center">
				<Loader2 class="w-6 h-6 text-brand-primary animate-spin mx-auto mb-3" />
				<h3 class="text-lg font-bold text-white mb-1">Submitting intake...</h3>
				<p class="text-xs text-gray-400">Finalizing your project profile.</p>
			</div>
		</div>

		<div
			v-if="showConfirmModal"
			class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
			<div
				class="bg-[#12141A] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
				<div class="flex items-center gap-3 mb-4">
					<div class="p-3 bg-brand-primary/20 rounded-full">
						<Send class="w-6 h-6 text-brand-primary" />
					</div>
					<div>
						<h3 class="text-lg font-bold text-white">
							Finalize Project Profile?
						</h3>
						<p class="text-sm text-gray-400">This action cannot be undone.</p>
					</div>
				</div>

				<p class="text-gray-300 text-sm mb-4">
					By submitting, this version will be
					<strong class="text-white">locked</strong> and sent to our AI agents
					for analysis. You can create a new version later if you need to make
					changes.
				</p>

				<label
					class="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10 mb-6 cursor-pointer hover:bg-white/10 transition-colors">
					<input
						type="checkbox"
						class="w-4 h-4 rounded bg-black border-gray-600 text-brand-primary focus:ring-brand-primary"
						:checked="Boolean(formData._confirmSubmit)"
						@change="setConfirmSubmit($event.target.checked)" />
					<span class="text-sm text-white">
						I confirm the information is accurate and ready for AI analysis
					</span>
				</label>

				<div class="flex gap-3">
					<Button
						variant="secondary"
						class="flex-1"
						:disabled="isSubmitting"
						@click="closeConfirmModal">
						Cancel
					</Button>
					<Button
						class="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:opacity-50"
						:disabled="isSubmitting || !formData._confirmSubmit"
						@click="confirmSubmit">
						<Loader2 v-if="isSubmitting" class="w-4 h-4 mr-2 animate-spin" />
						<Send v-else class="w-4 h-4 mr-2" />
						{{ isSubmitting ? "Submitting..." : "Submit" }}
					</Button>
				</div>
			</div>
		</div>

		<div
			v-if="!draft && !isLoading"
			class="view-section flex flex-col items-center justify-center h-[50vh] text-center">
			<h2 class="text-xl font-bold text-white mb-4">No Draft Found</h2>
			<p class="text-gray-400 mb-6">Create a new draft to edit this project.</p>
			<Button @click="startNewDraft">Start New Draft</Button>
		</div>

		<div v-else-if="draft" class="view-section max-w-6xl mx-auto pb-40">
			<div
				class="flex items-center justify-between mb-8 sticky top-0 bg-[#0B0C0F]/95 backdrop-blur z-20 py-4 border-b border-white/5">
				<div class="flex items-center gap-4">
					<RouterLink
						to="/dashboard/projects"
						class="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors">
						<ChevronLeft class="w-5 h-5" />
					</RouterLink>
					<div>
						<h1 class="text-xl font-bold text-white flex items-center gap-2">
							{{ project?.name }}
							<span
								class="text-xs font-normal text-gray-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">
								v{{ draft.version_num }} Draft
							</span>
						</h1>
						<p class="text-xs text-gray-400">Project Intake Wizard</p>
					</div>
				</div>
				<div class="flex items-center gap-4">
					<span class="text-xs text-gray-500 font-mono">
						<span
							v-if="isSaving"
							class="flex items-center gap-1 text-yellow-500">
							<Loader2 class="w-3 h-3 animate-spin" /> Saving...
						</span>
						<span v-else-if="lastSaved" class="flex items-center gap-1">
							<CheckCircle2 class="w-3 h-3 text-green-500" /> Saved
							{{ lastSaved.toLocaleTimeString() }}
						</span>
						<span v-else>Unsaved</span>
					</span>
					<Button variant="secondary" class="hidden md:flex" @click="saveDraft">
						<Save class="w-4 h-4 mr-2" />
						Save Draft
					</Button>
				</div>
			</div>

			<div class="grid grid-cols-12 gap-8">
				<div class="col-span-12 lg:col-span-3">
					<div
						class="bg-[#12141A] border border-white/10 rounded-xl p-4 sticky top-24">
						<div class="mb-6 px-2">
							<div class="h-1 bg-gray-800 rounded-full w-full mb-2">
								<div
									class="h-full bg-brand-primary rounded-full transition-all duration-500"
									:style="{ width: `${progress}%` }"></div>
							</div>
							<span class="text-xs text-brand-primary font-bold">
								{{ Math.round(progress) }}% Complete
							</span>
						</div>

						<nav class="space-y-1">
							<button
								v-for="(step, idx) in STEPS"
								:key="step.title"
								type="button"
								:disabled="idx > currentStep"
								@click="goToStep(idx)"
								class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
								:class="stepNavClass(idx)">
								<div
									class="w-6 h-6 rounded flex items-center justify-center shrink-0"
									:class="stepIconClass(idx)">
									<CheckCircle2 v-if="currentStep > idx" class="w-3.5 h-3.5" />
									<component v-else :is="step.icon" class="w-3.5 h-3.5" />
								</div>
								<span class="truncate">{{ step.title }}</span>
							</button>
						</nav>
					</div>
				</div>

				<div class="col-span-12 lg:col-span-9">
					<div
						class="bg-[#12141A] border border-white/10 rounded-xl p-6 md:p-8 min-h-[600px] flex flex-col relative overflow-hidden">
						<div class="mb-8 pb-6 border-b border-white/5">
							<div class="flex items-center gap-3 mb-2">
								<span
									class="bg-brand-primary/20 text-brand-primary text-xs font-bold px-2 py-1 rounded">
									Step {{ currentStep + 1 }} of {{ STEPS.length }}
								</span>
								<h2 class="text-2xl font-bold text-white">
									{{ STEPS[currentStep].title }}
								</h2>
							</div>
							<p class="text-gray-400 text-sm">
								Fill in the details below to help us understand your project.
							</p>
						</div>

						<div class="flex-1">
							<div
								v-if="currentStep === 0"
								class="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
								<div class="grid grid-cols-2 gap-6">
									<div class="col-span-2">
										<label class="block text-sm font-medium text-gray-300 mb-1">
											Project Name *
											<span
												v-if="errors['project_basics.project_name']"
												class="text-red-500 text-xs ml-2">
												{{ errors["project_basics.project_name"] }}
											</span>
										</label>
										<input
											type="text"
											:value="formData.project_basics?.project_name || ''"
											@input="
												updateField(
													'project_basics',
													'project_name',
													$event.target.value,
												)
											"
											class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
									</div>
									<div class="col-span-2 md:col-span-1">
										<label class="block text-sm font-medium text-gray-300 mb-1">
											Industry *
											<span
												v-if="errors['project_basics.industry']"
												class="text-red-500 text-xs ml-2">
												{{ errors["project_basics.industry"] }}
											</span>
										</label>
										<select
											:value="formData.project_basics?.industry || 'Technology'"
											@change="
												updateField(
													'project_basics',
													'industry',
													$event.target.value,
												)
											"
											class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none appearance-none">
											<option
												v-for="industry in INDUSTRIES"
												:key="industry"
												:value="industry">
												{{ industry }}
											</option>
										</select>
									</div>
									<div class="col-span-2 md:col-span-1">
										<label class="block text-sm font-medium text-gray-300 mb-1"
											>Website URL</label
										>
										<input
											type="url"
											:value="formData.project_basics?.website_url || ''"
											@input="
												updateField(
													'project_basics',
													'website_url',
													$event.target.value,
												)
											"
											placeholder="https://example.com"
											class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
									</div>
									<div class="col-span-2 md:col-span-1">
										<label class="block text-sm font-medium text-gray-300 mb-1"
											>Primary Contact Name</label
										>
										<input
											type="text"
											:value="
												formData.project_basics?.primary_contact_name || ''
											"
											@input="
												updateField(
													'project_basics',
													'primary_contact_name',
													$event.target.value,
												)
											"
											class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
									</div>
									<div class="col-span-2 md:col-span-1">
										<label class="block text-sm font-medium text-gray-300 mb-1"
											>Email</label
										>
										<input
											type="email"
											:value="
												formData.project_basics?.primary_contact_email || ''
											"
											@input="
												updateField(
													'project_basics',
													'primary_contact_email',
													$event.target.value,
												)
											"
											class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
									</div>
								</div>
							</div>

							<div
								v-if="currentStep === 1"
								class="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
								<div>
									<label class="block text-sm font-medium text-gray-300 mb-1">
										Short Description *
										<span
											v-if="errors['business_summary.short_description']"
											class="text-red-500 text-xs ml-2">
											{{ errors["business_summary.short_description"] }}
										</span>
									</label>
									<p class="text-xs text-gray-500 mb-2">
										1-3 sentences describing what your company does.
									</p>
									<textarea
										:value="formData.business_summary?.short_description || ''"
										@input="
											updateField(
												'business_summary',
												'short_description',
												$event.target.value,
											)
										"
										rows="3"
										class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-300 mb-1">
										Product/Service Details *
										<span
											v-if="
												errors[
													'business_summary.product_or_service_description'
												]
											"
											class="text-red-500 text-xs ml-2">
											{{
												errors[
													"business_summary.product_or_service_description"
												]
											}}
										</span>
									</label>
									<textarea
										:value="
											formData.business_summary
												?.product_or_service_description || ''
										"
										@input="
											updateField(
												'business_summary',
												'product_or_service_description',
												$event.target.value,
											)
										"
										rows="4"
										class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
								</div>
								<div class="grid grid-cols-2 gap-6">
									<div>
										<label class="block text-sm font-medium text-gray-300 mb-1">
											Primary Goal *
											<span
												v-if="errors['business_summary.primary_goal']"
												class="text-red-500 text-xs ml-2">
												{{ errors["business_summary.primary_goal"] }}
											</span>
										</label>
										<select
											:value="
												formData.business_summary?.primary_goal || 'Leads'
											"
											@change="
												updateField(
													'business_summary',
													'primary_goal',
													$event.target.value,
												)
											"
											class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none">
											<option value="Leads">Leads & Inquiries</option>
											<option value="Sales">Direct Sales</option>
											<option value="Awareness">Brand Awareness</option>
											<option value="Retention">Customer Retention</option>
											<option value="Other">Other</option>
										</select>
									</div>
									<div>
										<label class="block text-sm font-medium text-gray-300 mb-1"
											>Geographic Focus</label
										>
										<input
											type="text"
											placeholder="e.g. United States, Global, NYC"
											:value="formData.business_summary?.geographic_focus || ''"
											@input="
												updateField(
													'business_summary',
													'geographic_focus',
													$event.target.value,
												)
											"
											class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
									</div>
								</div>
							</div>

							<div
								v-if="currentStep === 2"
								class="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
								<div>
									<label class="block text-sm font-medium text-gray-300 mb-1">
										Ideal Customer Profile *
										<span
											v-if="
												errors['target_audience.ideal_customer_description']
											"
											class="text-red-500 text-xs ml-2">
											{{ errors["target_audience.ideal_customer_description"] }}
										</span>
									</label>
									<p class="text-xs text-gray-500 mb-2">
										Who is your absolute best customer?
									</p>
									<textarea
										:value="
											formData.target_audience?.ideal_customer_description || ''
										"
										@input="
											updateField(
												'target_audience',
												'ideal_customer_description',
												$event.target.value,
											)
										"
										rows="4"
										class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-300 mb-1">
										Top Pain Points *
										<span
											v-if="errors['target_audience.top_pain_points']"
											class="text-red-500 text-xs ml-2">
											{{ errors["target_audience.top_pain_points"] }}
										</span>
									</label>
									<p class="text-xs text-gray-500 mb-2">
										What problems do you solve for them? List at least 3.
									</p>
									<textarea
										:value="formData.target_audience?.top_pain_points || ''"
										@input="
											updateField(
												'target_audience',
												'top_pain_points',
												$event.target.value,
											)
										"
										rows="4"
										placeholder="- Problem 1&#10;- Problem 2&#10;- Problem 3"
										class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
								</div>
								<div class="grid grid-cols-2 gap-6">
									<div>
										<label class="block text-sm font-medium text-gray-300 mb-1"
											>Demographics</label
										>
										<input
											type="text"
											placeholder="Age 25-45, Male, High Income"
											:value="formData.target_audience?.demographics || ''"
											@input="
												updateField(
													'target_audience',
													'demographics',
													$event.target.value,
												)
											"
											class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
									</div>
									<div>
										<label class="block text-sm font-medium text-gray-300 mb-1"
											>Exclusions</label
										>
										<input
											type="text"
											placeholder="We do NOT target..."
											:value="formData.target_audience?.exclusions || ''"
											@input="
												updateField(
													'target_audience',
													'exclusions',
													$event.target.value,
												)
											"
											class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
									</div>
								</div>
							</div>

							<div
								v-if="currentStep === 3"
								class="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
								<div>
									<label class="block text-sm font-medium text-gray-300 mb-1">
										Primary Offer *
										<span
											v-if="errors['offer_funnel.primary_offer']"
											class="text-red-500 text-xs ml-2">
											{{ errors["offer_funnel.primary_offer"] }}
										</span>
									</label>
									<p class="text-xs text-gray-500 mb-2">
										What specifically are you selling right now?
									</p>
									<textarea
										:value="formData.offer_funnel?.primary_offer || ''"
										@input="
											updateField(
												'offer_funnel',
												'primary_offer',
												$event.target.value,
											)
										"
										rows="2"
										class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
								</div>
								<div class="grid grid-cols-2 gap-6">
									<div>
										<label class="block text-sm font-medium text-gray-300 mb-1">
											Primary Call to Action *
											<span
												v-if="errors['offer_funnel.primary_call_to_action']"
												class="text-red-500 text-xs ml-2">
												{{ errors["offer_funnel.primary_call_to_action"] }}
											</span>
										</label>
										<input
											type="text"
											placeholder="e.g. Book a Call, Buy Now"
											:value="
												formData.offer_funnel?.primary_call_to_action || ''
											"
											@input="
												updateField(
													'offer_funnel',
													'primary_call_to_action',
													$event.target.value,
												)
											"
											class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
									</div>
									<div>
										<label class="block text-sm font-medium text-gray-300 mb-1"
											>Pricing Range</label
										>
										<input
											type="text"
											placeholder="$100 - $500"
											:value="formData.offer_funnel?.pricing_range || ''"
											@input="
												updateField(
													'offer_funnel',
													'pricing_range',
													$event.target.value,
												)
											"
											class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
									</div>
								</div>
							</div>

							<div
								v-if="currentStep === 4"
								class="space-y-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
								<div class="space-y-6">
									<label class="block text-sm font-medium text-gray-300 mb-1"
										>Voice Personality</label
									>
									<div
										v-for="slider in VOICE_SLIDERS"
										:key="slider.key"
										class="space-y-2">
										<div class="flex justify-between text-xs text-gray-400">
											<span>{{ slider.left }}</span>
											<span>{{ slider.right }}</span>
										</div>
										<input
											type="range"
											min="0"
											max="100"
											:value="formData.brand_voice?.[slider.key] || 50"
											@input="
												updateField(
													'brand_voice',
													slider.key,
													parseInt($event.target.value, 10),
												)
											"
											class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-primary" />
									</div>
								</div>

								<div>
									<label class="block text-sm font-medium text-gray-300 mb-1">
										Core Values *
										<span
											v-if="errors['brand_voice.brand_values']"
											class="text-red-500 text-xs ml-2">
											{{ errors["brand_voice.brand_values"] }}
										</span>
									</label>
									<input
										type="text"
										placeholder="Integrity, Innovation, Speed (comma separated)"
										:value="formData.brand_voice?.brand_values || ''"
										@input="
											updateField(
												'brand_voice',
												'brand_values',
												$event.target.value,
											)
										"
										class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
								</div>
								<div class="grid grid-cols-2 gap-6">
									<div>
										<label class="block text-sm font-medium text-gray-300 mb-1"
											>Words We Like</label
										>
										<input
											type="text"
											placeholder="Modern, Slick, Fast"
											:value="formData.brand_voice?.words_we_like || ''"
											@input="
												updateField(
													'brand_voice',
													'words_we_like',
													$event.target.value,
												)
											"
											class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
									</div>
									<div>
										<label class="block text-sm font-medium text-gray-300 mb-1"
											>Words to AVOID</label
										>
										<input
											type="text"
											placeholder="Cheap, Discount, Hack"
											:value="formData.brand_voice?.words_we_avoid || ''"
											@input="
												updateField(
													'brand_voice',
													'words_we_avoid',
													$event.target.value,
												)
											"
											class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
									</div>
								</div>
							</div>

							<div
								v-if="currentStep === 5"
								class="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
								<div>
									<label class="block text-sm font-medium text-gray-300 mb-1">
										Logo URL *
										<span
											v-if="errors['visual_brand.logo_url']"
											class="text-red-500 text-xs ml-2">
											{{ errors["visual_brand.logo_url"] }}
										</span>
									</label>
									<div class="flex gap-2">
										<input
											type="url"
											placeholder="https://..."
											:value="formData.visual_brand?.logo_url || ''"
											@input="
												updateField(
													'visual_brand',
													'logo_url',
													$event.target.value,
												)
											"
											class="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
										<Button
											variant="secondary"
											class="shrink-0"
											@click="showUploadNotice">
											Upload
										</Button>
									</div>
								</div>
								<div class="grid grid-cols-2 gap-6">
									<div>
										<label class="block text-sm font-medium text-gray-300 mb-1"
											>Brand Colors</label
										>
										<input
											type="text"
											placeholder="#FF0000, #0000FF"
											:value="formData.visual_brand?.brand_colors || ''"
											@input="
												updateField(
													'visual_brand',
													'brand_colors',
													$event.target.value,
												)
											"
											class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
									</div>
									<div>
										<label class="block text-sm font-medium text-gray-300 mb-1"
											>Fonts</label
										>
										<input
											type="text"
											placeholder="Inter, Roboto"
											:value="formData.visual_brand?.fonts || ''"
											@input="
												updateField(
													'visual_brand',
													'fonts',
													$event.target.value,
												)
											"
											class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
									</div>
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-300 mb-1"
										>Image Style</label
									>
									<select
										:value="
											formData.visual_brand?.image_style || 'Photographic'
										"
										@change="
											updateField(
												'visual_brand',
												'image_style',
												$event.target.value,
											)
										"
										class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none">
										<option value="Photographic">Photographic</option>
										<option value="Illustrated">Illustrated</option>
										<option value="Minimalist">Minimalist</option>
										<option value="Bold/Vibrant">Bold & Vibrant</option>
										<option value="Corporate">Corporate</option>
									</select>
								</div>
							</div>

							<div
								v-if="currentStep === 6"
								class="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
								<div>
									<label class="block text-sm font-medium text-gray-300 mb-1">
										Competitors (Min 2) *
										<span
											v-if="errors['competitors.competitor_list']"
											class="text-red-500 text-xs ml-2">
											{{ errors["competitors.competitor_list"] }}
										</span>
									</label>
									<textarea
										:value="formData.competitors?.competitor_list || ''"
										@input="
											updateField(
												'competitors',
												'competitor_list',
												$event.target.value,
											)
										"
										rows="3"
										placeholder="1. Competitor A (website.com)&#10;2. Competitor B"
										class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-300 mb-1">
										Key Differentiators *
										<span
											v-if="errors['competitors.differentiators']"
											class="text-red-500 text-xs ml-2">
											{{ errors["competitors.differentiators"] }}
										</span>
									</label>
									<textarea
										:value="formData.competitors?.differentiators || ''"
										@input="
											updateField(
												'competitors',
												'differentiators',
												$event.target.value,
											)
										"
										rows="3"
										placeholder="Why do customers choose you over them?"
										class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-300 mb-1"
										>We Win Because...</label
									>
									<input
										type="text"
										:value="formData.competitors?.we_win_because || ''"
										@input="
											updateField(
												'competitors',
												'we_win_because',
												$event.target.value,
											)
										"
										class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
								</div>
							</div>

							<div
								v-if="currentStep === 7"
								class="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
								<div>
									<label class="block text-sm font-medium text-gray-300 mb-3">
										Active Channels *
										<span
											v-if="errors['channels.active_channels']"
											class="text-red-500 text-xs ml-2">
											{{ errors["channels.active_channels"] }}
										</span>
									</label>
									<div class="grid grid-cols-2 gap-3">
										<label
											v-for="channel in CHANNEL_OPTIONS"
											:key="channel"
											class="flex items-center gap-3 p-3 bg-black/30 rounded border border-white/10 hover:bg-white/5 cursor-pointer">
											<input
												type="checkbox"
												class="rounded bg-black border-gray-600 text-brand-primary focus:ring-brand-primary"
												:checked="
													formData.channels?.active_channels?.includes(
														channel,
													) || false
												"
												@change="
													toggleChannel(channel, $event.target.checked)
												" />
											<span class="text-white text-sm">{{ channel }}</span>
										</label>
									</div>
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-300 mb-1"
										>Content Topics to Focus On</label
									>
									<textarea
										:value="formData.channels?.topics_focus || ''"
										@input="
											updateField(
												'channels',
												'topics_focus',
												$event.target.value,
											)
										"
										rows="2"
										placeholder="e.g. Innovation, Company Culture, Industry News"
										class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
								</div>
							</div>

							<div
								v-if="currentStep === 8"
								class="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
								<div>
									<label class="block text-sm font-medium text-gray-300 mb-1">
										Posts You Like (Examples) *
										<span
											v-if="errors['examples.liked_examples']"
											class="text-red-500 text-xs ml-2">
											{{ errors["examples.liked_examples"] }}
										</span>
									</label>
									<p class="text-xs text-gray-500 mb-2">
										Links to posts or profiles that inspire you.
									</p>
									<textarea
										:value="formData.examples?.liked_examples || ''"
										@input="
											updateField(
												'examples',
												'liked_examples',
												$event.target.value,
											)
										"
										rows="4"
										class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-300 mb-1"
										>Do NOT Post...</label
									>
									<p class="text-xs text-gray-500 mb-2">
										Banned topics, claims, or styles.
									</p>
									<textarea
										:value="formData.examples?.banned_content || ''"
										@input="
											updateField(
												'examples',
												'banned_content',
												$event.target.value,
											)
										"
										rows="2"
										class="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:ring-1 focus:ring-brand-primary outline-none" />
								</div>
							</div>

							<div v-if="currentStep === 9" class="space-y-6">
								<div
									class="bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-6">
									<h3 class="text-brand-primary font-bold mb-2">
										Review Your Information
									</h3>
									<p class="text-gray-300 text-sm">
										Review the data below before submitting. Click "Submit
										Intake" when you're ready to finalize this version.
									</p>
								</div>
								<pre
									class="bg-black/50 p-4 rounded text-xs text-gray-500 overflow-auto max-h-96 border border-white/10"
									v-text="reviewJson"></pre>
							</div>
						</div>

						<div
							class="mt-12 pt-6 border-t border-white/10 flex justify-between">
							<Button
								variant="secondary"
								:disabled="currentStep === 0"
								@click="prevStep">
								<ChevronLeft class="w-4 h-4 mr-2" />
								Previous
							</Button>
							<Button
								v-if="currentStep === STEPS.length - 1"
								class="bg-green-600 hover:bg-green-500 text-white"
								@click="handleSubmit">
								Submit Intake <Send class="w-4 h-4 ml-2" />
							</Button>
							<Button v-else @click="nextStep">
								Next Step <ChevronRight class="w-4 h-4 ml-2" />
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div v-else class="view-section max-w-6xl mx-auto pb-40">
			<div class="text-sm text-gray-500">Loading intake...</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed, onMounted, ref, watch } from "vue"
	import { useRoute, useRouter, RouterLink } from "vue-router"
	import { toast } from "vue-sonner"
	import Button from "@/components/ui/Button.vue"
	import {
		CheckCircle2,
		ChevronRight,
		ChevronLeft,
		Save,
		Loader2,
		FileText,
		Layout,
		Users,
		Target,
		Zap,
		MessageSquare,
		Image,
		Share2,
		ShieldCheck,
		Send,
	} from "lucide-vue-next"

	const STEPS = [
		{ title: "Project Basics", icon: Layout },
		{ title: "Business Summary", icon: FileText },
		{ title: "Target Audience", icon: Users },
		{ title: "Offer + Funnel", icon: Target },
		{ title: "Brand Voice", icon: MessageSquare },
		{ title: "Visual Brand", icon: Image },
		{ title: "Competitors", icon: Zap },
		{ title: "Channels", icon: Share2 },
		{ title: "Examples", icon: ShieldCheck },
		{ title: "Review", icon: Send },
	]

	const INDUSTRIES = [
		"Technology",
		"E-commerce",
		"SaaS",
		"Healthcare",
		"Real Estate",
		"Finance",
		"Education",
		"Entertainment",
		"Consulting",
		"Other",
	]

	const VOICE_SLIDERS = [
		{ left: "Professional", right: "Casual", key: "prof_casual" },
		{ left: "Playful", right: "Serious", key: "play_serious" },
		{ left: "Bold", right: "Reserved", key: "bold_reserved" },
		{ left: "Technical", right: "Simple", key: "tech_simple" },
	]

	const CHANNEL_OPTIONS = [
		"LinkedIn",
		"X (Twitter)",
		"Facebook",
		"Instagram",
		"TikTok",
		"Blog",
		"Email",
	]

	const route = useRoute()
	const router = useRouter()

	const project = ref<any>(null)
	const draft = ref<any>(null)
	const formData = ref<any>({})
	const currentStep = ref(0)
	const isSaving = ref(false)
	const lastSaved = ref<Date | null>(null)
	const errors = ref<Record<string, string>>({})
	const showConfirmModal = ref(false)
	const isSubmitting = ref(false)
	const isLoading = ref(true)

	const hasField = (data: any, section: string, field: string) =>
		data?.[section]?.[field] && data[section][field].toString().trim() !== ""

	const isStepComplete = (data: any, step: number): boolean => {
		switch (step) {
			case 0:
				return (
					hasField(data, "project_basics", "project_name") &&
					hasField(data, "project_basics", "industry")
				)
			case 1:
				return (
					hasField(data, "business_summary", "short_description") &&
					hasField(
						data,
						"business_summary",
						"product_or_service_description",
					) &&
					hasField(data, "business_summary", "primary_goal")
				)
			case 2:
				return (
					hasField(data, "target_audience", "ideal_customer_description") &&
					hasField(data, "target_audience", "top_pain_points")
				)
			case 3:
				return (
					hasField(data, "offer_funnel", "primary_offer") &&
					hasField(data, "offer_funnel", "primary_call_to_action")
				)
			case 4:
				return hasField(data, "brand_voice", "brand_values")
			case 5:
				return hasField(data, "visual_brand", "logo_url")
			case 6:
				return (
					hasField(data, "competitors", "competitor_list") &&
					hasField(data, "competitors", "differentiators")
				)
			case 7:
				return (
					data?.channels?.active_channels &&
					data.channels.active_channels.length > 0
				)
			case 8:
				return hasField(data, "examples", "liked_examples")
			default:
				return false
		}
	}

	const getInitialStep = (data: any) => {
		if (!draft.value) return 0
		let highestComplete = -1
		for (let i = 0; i < 9; i += 1) {
			if (isStepComplete(data, i)) {
				highestComplete = i
			} else {
				break
			}
		}
		return Math.min(highestComplete + 1, 9)
	}

	const normalizeFormData = (data: any) => ({
		...data,
		project_basics: {
			...data.project_basics,
			industry: data.project_basics?.industry || "Technology",
		},
		business_summary: {
			...data.business_summary,
			primary_goal: data.business_summary?.primary_goal || "Leads",
		},
		visual_brand: {
			...data.visual_brand,
			image_style: data.visual_brand?.image_style || "Photographic",
		},
	})

	const fetchDraft = async () => {
		isLoading.value = true
		const id = route.params.id as string
		try {
			const res = await fetch(`/api/projects/${id}/intake/draft`, {
				headers: { "x-org-id": "demo-org" },
			})
			if (res.ok) {
				const data = (await res.json()) as any
				project.value = data.project
				draft.value = data.draft
				if (data.draft) {
					const parsed = JSON.parse(data.draft.data_json || "{}")
					const normalized = normalizeFormData(parsed)
					formData.value = normalized
					currentStep.value = getInitialStep(normalized)
					lastSaved.value = new Date(data.draft.updated_at || Date.now())
				} else {
					formData.value = {}
					currentStep.value = 0
					lastSaved.value = null
				}
				return
			}

			if (res.status === 404) {
				const projectRes = await fetch(`/api/projects/${id}`, {
					headers: { "x-org-id": "demo-org" },
				})
				if (projectRes.ok) {
					const data = (await projectRes.json()) as any
					project.value = data.project
					draft.value = data.draftIntake || null
					if (draft.value) {
						const parsed = JSON.parse(draft.value.data_json || "{}")
						const normalized = normalizeFormData(parsed)
						formData.value = normalized
						currentStep.value = getInitialStep(normalized)
						lastSaved.value = new Date(draft.value.updated_at || Date.now())
					} else {
						formData.value = {}
						currentStep.value = 0
						lastSaved.value = null
					}
					return
				}
			}

			router.replace("/projects")
		} catch (error) {
			console.error("Intake loader error", error)
		} finally {
			isLoading.value = false
		}
	}

	const saveDraft = async () => {
		if (!draft.value || !project.value) return
		isSaving.value = true
		try {
			await fetch(
				`/api/projects/${project.value.id}/intake/${draft.value.id}`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						"x-org-id": "demo-org",
						"x-actor-id": "demo-user",
					},
					body: JSON.stringify({
						data_json: formData.value,
						step: currentStep.value,
					}),
				},
			)
			lastSaved.value = new Date()
		} catch (error) {
			console.error("Autosave failed", error)
		} finally {
			isSaving.value = false
		}
	}

	const updateField = (section: string, field: string, value: any) => {
		formData.value = {
			...formData.value,
			[section]: {
				...(formData.value[section] || {}),
				[field]: value,
			},
		}
		const errorKey = `${section}.${field}`
		if (errors.value[errorKey]) {
			const nextErrors = { ...errors.value }
			delete nextErrors[errorKey]
			errors.value = nextErrors
		}
	}

	const validateStep = (step: number) => {
		const newErrors: Record<string, string> = {}
		let isValid = true
		const requireField = (section: string, field: string, label: string) => {
			if (
				!formData.value[section]?.[field] ||
				formData.value[section][field].toString().trim() === ""
			) {
				newErrors[`${section}.${field}`] = `${label} is required`
				isValid = false
			}
		}

		switch (step) {
			case 0:
				requireField("project_basics", "project_name", "Project Name")
				requireField("project_basics", "industry", "Industry")
				break
			case 1:
				requireField(
					"business_summary",
					"short_description",
					"Short Description",
				)
				requireField(
					"business_summary",
					"product_or_service_description",
					"Product/Service Description",
				)
				requireField("business_summary", "primary_goal", "Primary Goal")
				break
			case 2:
				requireField(
					"target_audience",
					"ideal_customer_description",
					"Ideal Customer Profile",
				)
				requireField("target_audience", "top_pain_points", "Top Pain Points")
				break
			case 3:
				requireField("offer_funnel", "primary_offer", "Primary Offer")
				requireField(
					"offer_funnel",
					"primary_call_to_action",
					"Primary Call to Action",
				)
				break
			case 4:
				requireField("brand_voice", "brand_values", "Core Values")
				break
			case 5:
				requireField("visual_brand", "logo_url", "Logo URL")
				break
			case 6:
				requireField("competitors", "competitor_list", "Competitor List")
				requireField("competitors", "differentiators", "Key Differentiators")
				break
			case 7:
				if (
					!formData.value.channels?.active_channels ||
					formData.value.channels.active_channels.length === 0
				) {
					newErrors["channels.active_channels"] =
						"Please select at least one channel"
					isValid = false
				}
				break
			case 8:
				requireField("examples", "liked_examples", "Examples")
				break
		}

		errors.value = newErrors
		return isValid
	}

	const nextStep = () => {
		if (validateStep(currentStep.value)) {
			if (currentStep.value < STEPS.length - 1) {
				currentStep.value += 1
				saveDraft()
				window.scrollTo(0, 0)
			}
		} else {
			window.scrollTo(0, 0)
		}
	}

	const prevStep = () => {
		if (currentStep.value > 0) {
			currentStep.value -= 1
			window.scrollTo(0, 0)
		}
	}

	const handleSubmit = () => {
		let allValid = true
		const allErrors: Record<string, string> = {}
		const requireField = (section: string, field: string, label: string) => {
			if (
				!formData.value[section]?.[field] ||
				formData.value[section][field].toString().trim() === ""
			) {
				allErrors[`${section}.${field}`] = `${label} is required`
				allValid = false
			}
		}

		requireField("project_basics", "project_name", "Project Name")
		requireField("project_basics", "industry", "Industry")
		requireField("business_summary", "short_description", "Short Description")
		requireField(
			"business_summary",
			"product_or_service_description",
			"Product/Service Details",
		)
		requireField("business_summary", "primary_goal", "Primary Goal")
		requireField(
			"target_audience",
			"ideal_customer_description",
			"Ideal Customer Profile",
		)
		requireField("target_audience", "top_pain_points", "Top Pain Points")
		requireField("offer_funnel", "primary_offer", "Primary Offer")
		requireField("offer_funnel", "primary_call_to_action", "Primary CTA")
		requireField("brand_voice", "brand_values", "Core Values")
		requireField("visual_brand", "logo_url", "Logo URL")
		requireField("competitors", "competitor_list", "Competitor List")
		requireField("competitors", "differentiators", "Key Differentiators")
		if (
			!formData.value.channels?.active_channels ||
			formData.value.channels.active_channels.length === 0
		) {
			allErrors["channels.active_channels"] = "Select at least one channel"
			allValid = false
		}
		requireField("examples", "liked_examples", "Examples")

		if (!allValid) {
			errors.value = allErrors
			currentStep.value = 0
			window.scrollTo(0, 0)
			return
		}

		showConfirmModal.value = true
	}

	const confirmSubmit = async () => {
		if (!draft.value || !project.value) return
		isSubmitting.value = true
		showConfirmModal.value = false
		await saveDraft()
		try {
			const res = await fetch(
				`/api/projects/${project.value.id}/intake/${draft.value.id}/submit`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-org-id": "demo-org",
						"x-actor-id": "demo-user",
					},
				},
			)
			if (res.ok) {
				const data = (await res.json()) as { status: string }
				if (data.status === "ACTIVE") {
					router.push({ name: "dashboard" })
					return
				}
			} else {
				const errorData = await res.text()
				console.error("Submit failed", errorData)
			}
		} catch (error) {
			console.error("Submit error", error)
		} finally {
			isSubmitting.value = false
		}
	}

	const closeConfirmModal = () => {
		showConfirmModal.value = false
		formData.value = {
			...formData.value,
			_confirmSubmit: false,
		}
	}

	const setConfirmSubmit = (checked: boolean) => {
		formData.value = {
			...formData.value,
			_confirmSubmit: checked,
		}
	}

	const startNewDraft = async () => {
		const projectId = project.value?.id ?? (route.params.id as string)
		if (!projectId) return
		const res = await fetch(`/api/projects/${projectId}/intake/draft`, {
			method: "POST",
			headers: { "x-org-id": "demo-org" },
		})
		const data = (await res.json()) as any
		if (data.draftId) {
			await fetchDraft()
		}
	}

	const showUploadNotice = () => {
		toast.info(
			"File upload simulation: Please host your logo and paste the link for now.",
		)
	}

	const goToStep = (idx: number) => {
		if (idx <= currentStep.value) {
			currentStep.value = idx
		}
	}

	const stepNavClass = (idx: number) => {
		if (currentStep.value === idx) {
			return "bg-brand-primary/10 text-brand-primary font-semibold border border-brand-primary/20"
		}
		if (currentStep.value > idx) {
			return "text-gray-300 hover:bg-white/5 hover:text-white cursor-pointer"
		}
		return "text-gray-500 opacity-50 cursor-not-allowed"
	}

	const stepIconClass = (idx: number) => {
		if (currentStep.value === idx) {
			return "bg-brand-primary text-black"
		}
		if (currentStep.value > idx) {
			return "bg-green-500/20 text-green-500"
		}
		return "bg-gray-800"
	}

	const toggleChannel = (channel: string, checked: boolean) => {
		const current = formData.value.channels?.active_channels || []
		const next = checked
			? [...current, channel]
			: current.filter((c: string) => c !== channel)
		updateField("channels", "active_channels", next)
	}

	const progress = computed(
		() => (currentStep.value / (STEPS.length - 1)) * 100,
	)
	const reviewJson = computed(() => JSON.stringify(formData.value, null, 2))

	let autosaveTimer: number | undefined

	watch(
		() => formData.value,
		() => {
			if (!draft.value) return
			if (autosaveTimer) window.clearTimeout(autosaveTimer)
			autosaveTimer = window.setTimeout(() => {
				saveDraft()
			}, 2000)
		},
		{ deep: true },
	)

	watch(
		() => route.params.id,
		() => fetchDraft(),
	)

	onMounted(fetchDraft)
</script>
